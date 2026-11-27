import Foundation

enum SiteAddress {
    static func parse(_ input: String) -> URL? {
        let value = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, !value.contains("\\") else { return nil }
        let text = value.contains("://") ? value : "https://" + value
        guard var url = URLComponents(string: text), url.scheme?.lowercased() == "https",
              let host = url.host, !host.isEmpty, url.user == nil, url.password == nil,
              url.query == nil, url.fragment == nil, url.path.isEmpty || url.path == "/" else { return nil }
        url.scheme = "https"
        url.path = "/"
        return url.url
    }

    static func sameOrigin(_ candidate: URL, as base: URL) -> Bool {
        candidate.scheme?.lowercased() == base.scheme?.lowercased() &&
        candidate.host?.lowercased() == base.host?.lowercased() &&
        (candidate.port ?? 443) == (base.port ?? 443) && candidate.user == nil && candidate.password == nil
    }
}

enum SolarPage: String, CaseIterable {
    case home = "/"
    case consultation = "/tuvan"
    case products = "/products"
    case news = "/news"
    case demo = "/demo"

    static func at(_ url: URL) -> SolarPage? {
        switch url.path {
        case "", "/", "/home", "/home.html": .home
        case "/tuvan", "/tuvan/", "/index.html": .consultation
        case "/products", "/products/", "/products.html": .products
        case "/news", "/news/", "/news.html": .news
        case "/demo", "/demo/", "/demo.html": .demo
        default: nil
        }
    }
}
