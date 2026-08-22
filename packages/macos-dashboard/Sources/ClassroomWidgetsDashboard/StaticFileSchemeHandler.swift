import Foundation
@preconcurrency import WebKit

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

        if let cached = cachedPayload(for: fileURL) {
            complete(task: urlSchemeTask, taskID: taskID, requestURL: requestURL, payload: cached)
            return
        }

        ioQueue.async { [weak self] in
            guard let self else { return }
            do {
                let payload = try self.loadPayload(for: fileURL)
                self.complete(task: urlSchemeTask, taskID: taskID, requestURL: requestURL, payload: payload)
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
        payload: (data: Data, mimeType: String)
    ) {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.complete(task: task, taskID: taskID, requestURL: requestURL, payload: payload)
            }
            return
        }

        guard !isStopped(taskID) else { return }

        let response = HTTPURLResponse(
            url: requestURL,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": payload.mimeType,
                "Content-Length": "\(payload.data.count)",
                "Cache-Control": cacheControl(for: requestURL)
            ]
        ) ?? URLResponse(
            url: requestURL,
            mimeType: payload.mimeType,
            expectedContentLength: payload.data.count,
            textEncodingName: nil
        )

        task.didReceive(response)
        task.didReceive(payload.data)
        task.didFinish()
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
        case "json", "webmanifest":
            return "application/json"
        default:
            return "application/octet-stream"
        }
    }
}
