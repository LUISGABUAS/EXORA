import Foundation
import WidgetKit

@objc(WidgetDataBridge)
class WidgetDataBridge: NSObject {

    private let appGroup = "group.com.exora.finance.app"

    @objc
    func updateWidgetData(_ jsonString: String) {
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            NSLog("[Widget] ERROR: No se pudo acceder al App Group '\(appGroup)'")
            return
        }
        defaults.set(jsonString, forKey: "widgetData")
        defaults.synchronize()
        NSLog("[Widget] Datos escritos correctamente (%d bytes)", jsonString.count)
        WidgetCenter.shared.reloadAllTimelines()
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
