import Foundation
import WebKit

final class StaticFileSchemeHandler: NSObject, WKURLSchemeHandler {
    private let webRoot: URL
    private let readQueue = DispatchQueue(label: "com.classroomwidgets.dashboard.static-files", qos: .userInitiated)
    private let stateQueue = DispatchQueue(label: "com.classroomwidgets.dashboard.static-files.state")
    private var cache: [URL: (data: Data, mimeType: String)] = [:]
    private var stoppedTasks = Set<ObjectIdentifier>()

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
        _ = stateQueue.sync {
            stoppedTasks.remove(taskID)
        }

        readQueue.async { [weak self] in
            guard let self else { return }

            do {
                let payload = try self.payload(for: fileURL)
                DispatchQueue.main.async {
                    guard !self.isStopped(taskID) else { return }

                    let response = URLResponse(
                        url: requestURL,
                        mimeType: payload.mimeType,
                        expectedContentLength: payload.data.count,
                        textEncodingName: nil
                    )
                    urlSchemeTask.didReceive(response)
                    urlSchemeTask.didReceive(payload.data)
                    urlSchemeTask.didFinish()
                }
            } catch {
                DispatchQueue.main.async {
                    guard !self.isStopped(taskID) else { return }
                    urlSchemeTask.didFailWithError(error)
                }
            }
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        let taskID = ObjectIdentifier(urlSchemeTask)
        _ = stateQueue.sync {
            stoppedTasks.insert(taskID)
        }
    }

    private func fileURL(for requestURL: URL) -> URL? {
        let rawPath = requestURL.path == "/" ? "/index.html" : requestURL.path
        let relativePath = rawPath.split(separator: "/").map(String.init).joined(separator: "/")
        let fileURL = webRoot.appendingPathComponent(relativePath).resolvingSymlinksInPath().standardizedFileURL

        guard isInsideWebRoot(fileURL) else {
            return nil
        }

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

    private func payload(for fileURL: URL) throws -> (data: Data, mimeType: String) {
        if let cached = stateQueue.sync(execute: { cache[fileURL] }) {
            return cached
        }

        let payload = (
            data: try Data(contentsOf: fileURL),
            mimeType: mimeType(for: fileURL.pathExtension)
        )
        stateQueue.sync {
            cache[fileURL] = payload
        }
        return payload
    }

    private func isStopped(_ taskID: ObjectIdentifier) -> Bool {
        stateQueue.sync {
            stoppedTasks.remove(taskID) != nil
        }
    }

    private func mimeType(for pathExtension: String) -> String {
        switch pathExtension.lowercased() {
        case "html":
            return "text/html"
        case "js", "mjs":
            return "text/javascript"
        case "css":
            return "text/css"
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
