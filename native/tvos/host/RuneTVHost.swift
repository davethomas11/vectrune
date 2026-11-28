import SwiftUI
import CoreGraphics
import QuartzCore
import AVFoundation
import Darwin

@_silgen_name("rune_tv_create")
func runeTVCreate(_ source: UnsafePointer<CChar>, _ width: UInt32, _ height: UInt32,
                  _ audio: UnsafeMutableRawPointer?,
                  _ error: UnsafeMutablePointer<UInt8>, _ errorBytes: Int) -> UnsafeMutableRawPointer?
@_silgen_name("rune_tv_dimensions")
func runeTVDimensions(_ handle: UnsafeMutableRawPointer, _ width: UnsafeMutablePointer<UInt32>,
                      _ height: UnsafeMutablePointer<UInt32>) -> Int32
@_silgen_name("rune_tv_frame")
func runeTVFrame(_ handle: UnsafeMutableRawPointer, _ ticks: UInt32, _ pixels: UnsafeMutablePointer<UInt8>,
                 _ pixelBytes: Int, _ timings: UnsafeMutablePointer<ProbeTimings>,
                 _ error: UnsafeMutablePointer<UInt8>, _ errorBytes: Int) -> Int32
@_silgen_name("rune_tv_set_storage_directory")
func runeTVSetStorageDirectory(_ path: UnsafePointer<CChar>) -> Int32

@_silgen_name("rune_tv_input")
func runeTVInput(_ handle: UnsafeMutableRawPointer, _ command: UInt32,
                 _ error: UnsafeMutablePointer<UInt8>, _ errorBytes: Int) -> Int32
@_silgen_name("rune_tv_flush_save")
func runeTVFlushSave(_ handle: UnsafeMutableRawPointer, _ error: UnsafeMutablePointer<UInt8>, _ errorBytes: Int) -> Int32
@_silgen_name("rune_tv_destroy")
func runeTVDestroy(_ handle: UnsafeMutableRawPointer)
@_silgen_name("rune_tv_audio_create")
func runeTVAudioCreate() -> UnsafeMutableRawPointer?
@_silgen_name("rune_tv_audio_render")
func runeTVAudioRender(_ handle: UnsafeMutableRawPointer, _ output: UnsafeMutablePointer<Float>, _ frames: Int)
@_silgen_name("rune_tv_audio_destroy")
func runeTVAudioDestroy(_ handle: UnsafeMutableRawPointer)
@_silgen_name("rune_tv_audio_stats")
func runeTVAudioStats(_ handle: UnsafeMutableRawPointer, _ stats: UnsafeMutablePointer<AudioStats>)

struct AudioStats {
    var frames: UInt64 = 0
    var nonzero: UInt64 = 0
    var peak: Float = 0
    var dropped: UInt64 = 0
}

final class ProbeAudio {
    let handle: UnsafeMutableRawPointer
    private let engine: AVAudioEngine
    private let source: AVAudioSourceNode

    init() throws {
        guard let handle = runeTVAudioCreate() else {
            throw NSError(domain: "RuneAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not create the audio mixer."])
        }
        self.handle = handle
        let engine = AVAudioEngine()
        self.engine = engine
        let source = AVAudioSourceNode { _, _, frameCount, output in
            let buffers = UnsafeMutableAudioBufferListPointer(output)
            guard buffers.count == 1, let data = buffers[0].mData,
                  buffers[0].mDataByteSize >= frameCount * UInt32(MemoryLayout<Float>.size) else {
                return kAudio_ParamError
            }
            runeTVAudioRender(handle, data.assumingMemoryBound(to: Float.self), Int(frameCount))
            return noErr
        }
        self.source = source
        guard let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1) else {
            runeTVAudioDestroy(handle)
            throw NSError(domain: "RuneAudio", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not create an audio format."])
        }
        engine.attach(source)
        engine.connect(source, to: engine.mainMixerNode, format: format)
        engine.prepare()
    }

    func start() throws {
        try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
        try AVAudioSession.sharedInstance().setActive(true)
        try engine.start()
    }

    func pause() { engine.pause() }

    deinit {
        engine.stop()
        engine.detach(source)
        runeTVAudioDestroy(handle)
    }
}

struct ProbeTimings {
    var simulationMS: Double = 0
    var transferMS: Double = 0
    var nativeMS: Double = 0
    var hudMS: Double = 0
    var schedulerMS: Double = 0
    var stepMS: Double = 0
}

func residentMemoryMB() -> Double {
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size / MemoryLayout<natural_t>.size)
    let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
            task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
    }
    return result == KERN_SUCCESS ? Double(info.resident_size) / 1_048_576 : 0
}

@main
struct RuneTVProbeApp: App {
    var body: some Scene {
        WindowGroup { ProbeView() }
    }
}

struct ProbeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = ProbeModel()
    @State private var showDebug = false
    @State private var showHint = true

    var body: some View {
        Button(action: { model.input(4) }) {
          ZStack(alignment: .bottomLeading) {
            Color.black
            if let picture = model.picture {
                Image(decorative: picture, scale: 1)
                    .interpolation(.none)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            if model.picture == nil || model.hasError || showDebug {
                Text(model.status)
                    .font(.caption)
                    .padding(12)
                    .background(.black.opacity(0.75))
                    .foregroundStyle(.white)
                    .padding(30)
            } else if showHint {
                Text("Remote: move and select  •  Play/Pause: diagnostics")
                    .font(.caption)
                    .padding(12)
                    .background(.black.opacity(0.75))
                    .foregroundStyle(.white)
                    .padding(30)
            }
          }
        }
        .buttonStyle(.plain)
        .ignoresSafeArea()
        .onMoveCommand { direction in
            switch direction {
            case .up: model.input(0)
            case .down: model.input(1)
            case .left: model.input(2)
            case .right: model.input(3)
            @unknown default: break
            }
        }
        .onExitCommand { model.input(5) }
        .onPlayPauseCommand { showDebug.toggle(); showHint = false }
        .onAppear {
            model.setActive(scenePhase == .active)
            DispatchQueue.main.asyncAfter(deadline: .now() + 12) { showHint = false }
        }
        .onChange(of: scenePhase) { _, phase in model.setActive(phase == .active) }
        .onDisappear { model.setActive(false) }
    }
}

@MainActor
final class ProbeModel: ObservableObject {
    @Published var picture: CGImage?
    @Published var status = "Starting Rune..."
    @Published var hasError = false
    private var worker: FrameWorker?

    func input(_ command: UInt32) { worker?.input(command) }

    func setActive(_ active: Bool) {
        NSLog("Rune probe scene active: %@", active ? "yes" : "no")
        if !active && worker == nil { status = "Waiting for the TV app to become active..." }
        if worker == nil && active {
            let worker = FrameWorker { [weak self] image, status in
                DispatchQueue.main.async {
                    if let image { self?.picture = image }
                    self?.status = status
                    self?.hasError = image == nil
                }
            }
            self.worker = worker
            worker.start()
        }
        worker?.setActive(active)
    }

    deinit { worker?.stop() }
}

final class FrameWorker {
    private let condition = NSCondition()
    private var active = false
    private var stopped = false
    private var presentationPending = false
    private var inputs: [UInt32] = []
    private let publish: (CGImage?, String) -> Void

    init(publish: @escaping (CGImage?, String) -> Void) { self.publish = publish }
    func start() { DispatchQueue(label: "rune.tv.probe").async { self.run() } }
    func setActive(_ value: Bool) {
        condition.lock()
        active = value
        if !value { inputs.removeAll() }
        condition.broadcast()
        condition.unlock()
    }
    func input(_ command: UInt32) {
        condition.lock()
        guard active && !stopped else { condition.unlock(); return }
        guard inputs.count < 128 else {
            condition.unlock()
            present(nil, "Remote input queue is full.")
            return
        }
        inputs.append(command)
        condition.unlock()
    }
    private func takeInputs() -> [UInt32] {
        condition.lock()
        let pending = inputs
        inputs.removeAll(keepingCapacity: true)
        condition.unlock()
        return pending
    }
    func stop() {
        condition.lock()
        stopped = true
        condition.broadcast()
        condition.unlock()
    }
    private func waitForActive() -> Bool {
        condition.lock()
        while !active && !stopped { condition.wait() }
        let shouldRun = !stopped
        condition.unlock()
        return shouldRun
    }
    private func isActive() -> Bool {
        condition.lock()
        defer { condition.unlock() }
        return active && !stopped
    }
    private func present(_ image: CGImage?, _ status: String) {
        if image == nil {
            DispatchQueue.main.async { self.publish(nil, status) }
            return
        }
        condition.lock()
        if presentationPending {
            condition.unlock()
            return
        }
        presentationPending = true
        condition.unlock()
        DispatchQueue.main.async {
            self.publish(image, status)
            self.condition.lock()
            self.presentationPending = false
            self.condition.unlock()
        }
    }
    private func run() {
        NSLog("Rune probe worker started")
        present(nil, "Loading compiled Rune game...")
        guard let url = Bundle.main.url(forResource: "game", withExtension: "js")
            ?? Bundle.main.url(forResource: "aquarium", withExtension: "js") else {
            present(nil, "Compiled Rune bundle is missing.")
            return
        }
        let source: String
        do { source = try String(contentsOf: url, encoding: .utf8) }
        catch {
            present(nil, "Could not load Rune: \(error.localizedDescription)")
            return
        }
        var error = [UInt8](repeating: 0, count: 4096)
        let audio: ProbeAudio
        do { audio = try ProbeAudio() }
        catch {
            present(nil, "Audio initialization error: \(error.localizedDescription)")
            return
        }
        if let support = try? FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("RuneSaves", isDirectory: true) {
            if ProcessInfo.processInfo.environment["RUNE_TV_RESET_SAVES"] == "1" {
                try? FileManager.default.removeItem(at: support)
            }
            if runeTVSetStorageDirectory(support.path) != 0 {
                NSLog("Rune saves unavailable; progress will not persist")
            }
        } else {
            NSLog("Rune saves unavailable; progress will not persist")
        }
        present(nil, "Initializing Rune and scene assets...")
        NSLog("Rune probe initializing runtime")
        guard let handle = source.withCString({ ptr in
            error.withUnsafeMutableBufferPointer { runeTVCreate(ptr, 0, 0, audio.handle, $0.baseAddress!, $0.count) }
        }) else {
            present(nil, "Rune initialization error: " + String(decoding: error.prefix { $0 != 0 }, as: UTF8.self))
            return
        }
        NSLog("Rune probe initialized runtime")
        defer { runeTVDestroy(handle) }
        var tvWidth: UInt32 = 0
        var tvHeight: UInt32 = 0
        guard runeTVDimensions(handle, &tvWidth, &tvHeight) == 0, tvWidth > 0, tvHeight > 0 else {
            present(nil, "Could not read TV framebuffer dimensions.")
            return
        }
        let width = Int(tvWidth), height = Int(tvHeight)
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let tickDuration = 1.0 / 30.0
        present(nil, "Preparing first native frame...")
        while waitForActive() {
            do { try audio.start() }
            catch {
                present(nil, "Audio playback error: \(error.localizedDescription)")
                return
            }
            var previous = CACurrentMediaTime()
            var accumulator = 0.0
            var statsTime = previous
            var frames = 0
            var totalTicks = 0
            var fps = 0.0
            var totals = ProbeTimings()
            var imageTotal = 0.0
            var summary = "Measuring..."
            while isActive() {
                for input in takeInputs() {
                    let result = error.withUnsafeMutableBufferPointer {
                        runeTVInput(handle, input, $0.baseAddress!, $0.count)
                    }
                    if result != 0 {
                        present(nil, "Remote input error: " + String(decoding: error.prefix { $0 != 0 }, as: UTF8.self))
                        return
                    }
                }
                let now = CACurrentMediaTime()
                accumulator += min(now - previous, tickDuration * 5)
                previous = now
                let ticks = min(Int(accumulator / tickDuration), 5)
                accumulator -= Double(ticks) * tickDuration
                var timings = ProbeTimings()
                if frames == 0 && statsTime == previous { NSLog("Rune probe rendering frame") }
                let result = pixels.withUnsafeMutableBufferPointer { frame in
                    error.withUnsafeMutableBufferPointer { message in
                        runeTVFrame(handle, UInt32(ticks), frame.baseAddress!, frame.count, &timings, message.baseAddress!, message.count)
                    }
                }
                if result != 0 {
                    NSLog("Rune probe frame error: %@", String(decoding: error.prefix { $0 != 0 }, as: UTF8.self))
                    present(nil, "Rune error: " + String(decoding: error.prefix { $0 != 0 }, as: UTF8.self))
                    return
                }
                let imageStart = CACurrentMediaTime()
                guard let provider = CGDataProvider(data: Data(pixels) as CFData),
                      let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
                          bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                          bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
                          provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent) else {
                    present(nil, "Could not create the framebuffer image.")
                    return
                }
                frames += 1
                totalTicks += ticks
                totals.simulationMS += timings.simulationMS
                totals.schedulerMS += timings.schedulerMS
                totals.stepMS += timings.stepMS
                totals.transferMS += timings.transferMS
                totals.nativeMS += timings.nativeMS
                totals.hudMS += timings.hudMS
                imageTotal += (CACurrentMediaTime() - imageStart) * 1000
                let finished = CACurrentMediaTime()
                if finished - statsTime >= 3 {
                    fps = Double(frames) / (finished - statsTime)
                    let count = Double(frames)
                    summary = String(format: "Native %d×%d enhanced • %.1f render fps\nSimulation %.0f ms • scene transfer %.0f ms • native %.0f ms\nHUD %.0f ms • image creation %.0f ms / frame",
                                     width, height, fps, totals.simulationMS / count, totals.transferMS / count,
                                     totals.nativeMS / count, totals.hudMS / count, imageTotal / count)
                    NSLog("Rune stats: fps=%.1f sim_ms=%.1f native_ms=%.1f memory_mb=%.0f",
                          fps, totals.simulationMS / count, totals.nativeMS / count, residentMemoryMB())
                    NSLog("Rune detail: ticks=%.2f step_ms=%.1f scheduler_ms=%.1f transfer_ms=%.1f hud_ms=%.1f",
                          Double(totalTicks) / count, totals.stepMS / count, totals.schedulerMS / count,
                          totals.transferMS / count, totals.hudMS / count)
                    var audioStats = AudioStats()
                    runeTVAudioStats(audio.handle, &audioStats)
                    NSLog("Rune audio: frames=%llu audible=%llu peak=%.4f dropped=%llu",
                          audioStats.frames, audioStats.nonzero, audioStats.peak, audioStats.dropped)
                    summary += String(format: "\nAudio frames %llu • audible %llu • peak %.4f • dropped %llu",
                                      audioStats.frames, audioStats.nonzero, audioStats.peak, audioStats.dropped)
                    frames = 0
                    totalTicks = 0
                    totals = ProbeTimings()
                    imageTotal = 0
                    statsTime = finished
                }
                present(image, summary + "\nExperimental • remote controls enabled")
                let delay = tickDuration - (CACurrentMediaTime() - now)
                if delay > 0 { Thread.sleep(forTimeInterval: delay) }
            }
            audio.pause()
            _ = error.withUnsafeMutableBufferPointer { runeTVFlushSave(handle, $0.baseAddress!, $0.count) }
        }
    }
}
