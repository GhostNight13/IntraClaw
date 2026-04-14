import AVFoundation
import Foundation

// Usage: swift speak.swift "Texte à dire" [voiceIdentifier]
let args = CommandLine.arguments
guard args.count >= 2 else {
  print("Usage: speak.swift \"text\" [voiceId]")
  exit(1)
}

let text = args[1]
let voiceId = args.count >= 3 ? args[2] : "com.apple.voice.enhanced.fr-FR.Thomas"

let synth = AVSpeechSynthesizer()
let utt   = AVSpeechUtterance(string: text)
utt.voice = AVSpeechSynthesisVoice(identifier: voiceId)
utt.rate  = 0.52
utt.pitchMultiplier = 1.0
utt.volume = 1.0

synth.speak(utt)

// Wait until done
while synth.isSpeaking {
  Thread.sleep(forTimeInterval: 0.1)
}
