import Foundation
import Vision
import UIKit

@objc(AppleVisionOCR)
class AppleVisionOCR: NSObject {

  @objc func recognizeText(
    _ imageUri: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      let cleanUri = imageUri.replacingOccurrences(of: "file://", with: "")

      guard let image = UIImage(contentsOfFile: cleanUri),
            let cgImage = image.cgImage else {
        rejecter("LOAD_ERROR", "No se pudo cargar la imagen", nil)
        return
      }

      let request = VNRecognizeTextRequest { req, error in
        if let error = error {
          rejecter("OCR_ERROR", error.localizedDescription, error)
          return
        }

        guard let observations = req.results as? [VNRecognizedTextObservation] else {
          rejecter("OCR_ERROR", "Sin resultados", nil)
          return
        }

        // Reconstruir el texto respetando la posición vertical (de arriba a abajo)
        let sorted = observations.sorted { $0.boundingBox.maxY > $1.boundingBox.maxY }
        let lines = sorted.compactMap { obs -> String? in
          guard let candidate = obs.topCandidates(1).first, candidate.confidence > 0.3 else { return nil }
          return candidate.string
        }

        resolver(lines.joined(separator: "\n"))
      }

      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["es-MX", "es-419", "es", "en-US"]
      request.usesLanguageCorrection = true
      request.minimumTextHeight = 0.01  // detectar texto pequeño en tickets

      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      do {
        try handler.perform([request])
      } catch {
        rejecter("OCR_ERROR", error.localizedDescription, error)
      }
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
