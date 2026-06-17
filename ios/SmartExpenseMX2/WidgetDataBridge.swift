import Foundation
import WidgetKit

@objc(WidgetDataBridge)
class WidgetDataBridge: NSObject {

    private let appGroup = "group.com.exora.finance.app"

    @objc
    func updateWidgetData(_ jsonString: String) {
        let defaults = UserDefaults(suiteName: appGroup)
        defaults?.set(jsonString, forKey: "widgetData")
        WidgetCenter.shared.reloadAllTimelines()
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
