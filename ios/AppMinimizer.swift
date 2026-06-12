import Foundation
import UIKit

@objc(AppMinimizer)
class AppMinimizer: NSObject {

  @objc
  func minimize() {
    DispatchQueue.main.async {
      UIApplication.shared.perform(#selector(NSXPCConnection.suspend))
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool { false }
}
