import Foundation
@preconcurrency import WebKit

/// How to answer a request's HTTP `Range` header for a body of `length`
/// bytes. Only a single byte range is honoured; for anything else the whole
/// body is sent, which HTTP allows.
enum StaticFileRange: Equatable {
    case whole
    case partial(Range<Int>)
    /// The range starts at or past the end of the body (416).
    case unsatisfiable

    init(header: String?, length: Int) {
        self = Self.parse(header, length: length) ?? .whole
    }

    private static func parse(_ header: String?, length: Int) -> StaticFileRange? {
        guard let header, length > 0 else { return nil }
        let parts = header.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2, parts[0].trimmingCharacters(in: .whitespaces).lowercased() == "bytes" else {
            return nil
        }
        let spec = parts[1].trimmingCharacters(in: .whitespaces)
        guard !spec.contains(",") else { return nil }
        let bounds = spec.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
        guard bounds.count == 2 else { return nil }

        if bounds[0].isEmpty {
            guard let suffix = position(bounds[1]) else { return nil }
            return suffix > 0 ? .partial(max(0, length - suffix)..<length) : .unsatisfiable
        }
        guard let start = position(bounds[0]) else { return nil }
        var end = length - 1
        if !bounds[1].isEmpty {
            guard let last = position(bounds[1]), last >= start else { return nil }
            end = min(last, end)
        }
        return start < length ? .partial(start..<(end + 1)) : .unsatisfiable
    }

    /// A decimal byte position: ASCII digits only, no sign.
    private static func position(_ text: Substring) -> Int? {
        guard !text.isEmpty, text.allSatisfy({ $0.isASCII && $0.isNumber }) else { return nil }
        return Int(text)
    }
}

final class StaticFileSchemeHandler: NSObject, WKURLSchemeHandler {
    private let webRoot: URL
    private let lock = NSLock()
    private let ioQueue = DispatchQueue(label: "classroom-widgets.static-files", qos: .userInitiated)
    private var cache: [URL: (data: Data, mimeType: String)] = [:]
    private var resolvedPaths: [String: URL] = [:]
    private var stoppedTasks = Set<ObjectIdentifier>()
    private var didStartPrewarm = false

    init(webRoot: URL) {
        self.webRoot = webRoot.resolvingSymlinksInPath().standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        guard let fileURL = fileURL(for: requestURL) else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }

        let taskID = ObjectIdentifier(urlSchemeTask)
        markStarted(taskID)
        let requestedAt = PerfProbe.isEnabled ? PerfProbe.wallMilliseconds() : 0

        if let cached = cachedPayload(for: fileURL) {
            complete(task: urlSchemeTask, taskID: taskID, requestURL: requestURL, payload: cached, requestedAt: requestedAt, hit: true)
            return
        }

        ioQueue.async { [weak self] in
            guard let self else { return }
            do {
                let payload = try self.loadPayload(for: fileURL)
                self.complete(task: urlSchemeTask, taskID: taskID, requestURL: requestURL, payload: payload, requestedAt: requestedAt, hit: false)
            } catch {
                self.fail(task: urlSchemeTask, taskID: taskID, error: error)
            }
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock()
        stoppedTasks.insert(ObjectIdentifier(urlSchemeTask))
        lock.unlock()
    }

    func prewarmCriticalAssets() {
        lock.lock()
        if didStartPrewarm {
            lock.unlock()
            return
        }
        didStartPrewarm = true
        lock.unlock()

        let root = webRoot
        ioQueue.async { [weak self] in
            guard let self else { return }
            let index = root.appendingPathComponent("index.html").standardizedFileURL
            guard let htmlPayload = try? self.loadPayload(for: index),
                  let html = String(data: htmlPayload.data, encoding: .utf8) else {
                return
            }

            for path in Self.referencedEntryAssets(in: html) {
                let relativePath = path.split(separator: "/").map(String.init).joined(separator: "/")
                let fileURL = root.appendingPathComponent(relativePath).standardizedFileURL
                guard self.isInsideWebRoot(fileURL) else { continue }
                _ = try? self.loadPayload(for: fileURL)
            }
        }
    }

    private static let entryAssetReferenceRegex = try! NSRegularExpression(
        pattern: #"(?:src|href)=["'](/[^"']+)["']"#
    )

    static func referencedEntryAssets(in html: String) -> [String] {
        let nsHTML = html as NSString
        let range = NSRange(location: 0, length: nsHTML.length)
        let matches = entryAssetReferenceRegex.matches(in: html, options: [], range: range)
        var seen = Set<String>()
        var paths: [String] = []

        for match in matches {
            guard match.numberOfRanges > 1 else { continue }
            let path = nsHTML.substring(with: match.range(at: 1))
            if path.hasPrefix("//") { continue }
            let ext = (path as NSString).pathExtension.lowercased()
            guard ext == "js" || ext == "mjs" || ext == "css" else { continue }
            if seen.insert(path).inserted {
                paths.append(path)
            }
        }

        return paths
    }

    private func fileURL(for requestURL: URL) -> URL? {
        let rawPath = requestURL.path == "/" ? "/index.html" : requestURL.path
        let relativePath = rawPath.split(separator: "/").map(String.init).joined(separator: "/")

        lock.lock()
        if let cached = resolvedPaths[relativePath] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        let fileURL = webRoot.appendingPathComponent(relativePath).standardizedFileURL
        guard isInsideWebRoot(fileURL) else {
            return nil
        }

        lock.lock()
        resolvedPaths[relativePath] = fileURL
        lock.unlock()
        return fileURL
    }

    private func isInsideWebRoot(_ fileURL: URL) -> Bool {
        let rootComponents = webRoot.pathComponents
        let fileComponents = fileURL.pathComponents

        guard fileComponents.count >= rootComponents.count else {
            return false
        }

        return zip(rootComponents, fileComponents).allSatisfy(==)
    }

    private func cachedPayload(for fileURL: URL) -> (data: Data, mimeType: String)? {
        lock.lock()
        let cached = cache[fileURL]
        lock.unlock()
        return cached
    }

    private func loadPayload(for fileURL: URL) throws -> (data: Data, mimeType: String) {
        if let cached = cachedPayload(for: fileURL) {
            return cached
        }

        let payload = (
            data: try Data(contentsOf: fileURL, options: .mappedIfSafe),
            mimeType: mimeType(for: fileURL.pathExtension)
        )

        lock.lock()
        cache[fileURL] = payload
        lock.unlock()
        return payload
    }

    private func markStarted(_ taskID: ObjectIdentifier) {
        lock.lock()
        stoppedTasks.remove(taskID)
        lock.unlock()
    }

    private func isStopped(_ taskID: ObjectIdentifier) -> Bool {
        lock.lock()
        let stopped = stoppedTasks.remove(taskID) != nil
        lock.unlock()
        return stopped
    }

    private func complete(
        task: WKURLSchemeTask,
        taskID: ObjectIdentifier,
        requestURL: URL,
        payload: (data: Data, mimeType: String),
        requestedAt: Double = 0,
        hit: Bool = false
    ) {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.complete(task: task, taskID: taskID, requestURL: requestURL, payload: payload, requestedAt: requestedAt, hit: hit)
            }
            return
        }

        guard !isStopped(taskID) else { return }

        // Media elements read audio in byte ranges; answering each with the
        // whole file made WebKit fetch the same file again and again.
        let length = payload.data.count
        var headerFields = [
            "Content-Type": payload.mimeType,
            "Accept-Ranges": "bytes",
            "Cache-Control": cacheControl(for: requestURL)
        ]
        let statusCode: Int
        let body: Data
        switch StaticFileRange(header: task.request.value(forHTTPHeaderField: "Range"), length: length) {
        case .whole:
            statusCode = 200
            body = payload.data
        case let .partial(bytes):
            statusCode = 206
            body = payload.data.subdata(in: bytes)
            headerFields["Content-Range"] = "bytes \(bytes.lowerBound)-\(bytes.upperBound - 1)/\(length)"
        case .unsatisfiable:
            statusCode = 416
            body = Data()
            headerFields["Content-Range"] = "bytes */\(length)"
        }
        headerFields["Content-Length"] = "\(body.count)"

        let response = HTTPURLResponse(
            url: requestURL,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: headerFields
        ) ?? URLResponse(
            url: requestURL,
            mimeType: payload.mimeType,
            expectedContentLength: body.count,
            textEncodingName: nil
        )

        task.didReceive(response)
        if !body.isEmpty {
            task.didReceive(body)
        }
        task.didFinish()
        if requestedAt > 0 {
            PerfProbe.mark("scheme.response", [
                "path": requestURL.path, "bytes": body.count, "status": statusCode, "hit": hit,
                "ms": PerfProbe.wallMilliseconds() - requestedAt
            ])
        }
    }

    private func fail(task: WKURLSchemeTask, taskID: ObjectIdentifier, error: Error) {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.fail(task: task, taskID: taskID, error: error)
            }
            return
        }

        guard !isStopped(taskID) else { return }
        task.didFailWithError(error)
    }

    private func cacheControl(for requestURL: URL) -> String {
        let name = requestURL.lastPathComponent
        if name == "index.html" || requestURL.path == "/" {
            return "no-cache"
        }
        if requestURL.path.contains("/assets/") {
            return "public, max-age=31536000, immutable"
        }
        return "public, max-age=86400"
    }

    private func mimeType(for pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "html":
            return "text/html; charset=utf-8"
        case "js", "mjs":
            return "text/javascript; charset=utf-8"
        case "css":
            return "text/css; charset=utf-8"
        case "svg":
            return "image/svg+xml"
        case "png":
            return "image/png"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "gif":
            return "image/gif"
        case "webp":
            return "image/webp"
        case "mp3":
            return "audio/mpeg"
        case "wav":
            return "audio/wav"
        case "woff2":
            return "font/woff2"
        case "woff":
            return "font/woff"
        case "json", "webmanifest":
            return "application/json"
        default:
            return "application/octet-stream"
        }
    }
}
