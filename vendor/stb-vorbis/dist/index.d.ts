/**
 * The sample format returned by the decoder.
 */
export type SampleType = "s16" | "f32";
/**
 * Options for decoding an Ogg Vorbis stream.
 */
export interface DecodeOptions {
    /**
     * Return signed 16-bit PCM or normalized 32-bit floating-point PCM.
     */
    readonly sampleType?: SampleType;
}
/**
 * Decoded Ogg Vorbis audio.
 *
 * PCM samples are planar. The sample array type is selected with
 * `DecodeOptions.sampleType`.
 */
export interface DecodedAudio<T extends Float32Array | Int16Array = Float32Array> {
    /**
     * The audio sample rate in Hz.
     */
    readonly sampleRate: number;
    /**
     * One PCM array for each audio channel.
     *
     * All channel arrays contain the same number of samples.
     */
    readonly channels: readonly T[];
}
/**
 * Synchronous Ogg Vorbis decoder backed by stb_vorbis.
 */
export declare class StbVorbis {
    /**
     * The exports of the WebAssembly decoder.
     * @private
     */
    private static exports;
    /**
     * Resolves when the underlying WebAssembly decoder is initialized.
     */
    static readonly ready: Promise<void>;
    /**
     * Decodes an entire Ogg Vorbis stream synchronously.
     *
     * The returned PCM arrays are normal JavaScript-owned typed arrays.
     * No WASM memory is retained after this method returns.
     *
     * @param data The complete Ogg Vorbis stream.
     * @param options
     * @returns The decoded planar PCM audio.
     */
    static decode(data: ArrayBuffer | Uint8Array, options: {
        readonly sampleType: "s16";
    }): DecodedAudio<Int16Array>;
    static decode(data: ArrayBuffer | Uint8Array, options?: {
        readonly sampleType?: "f32";
    }): DecodedAudio;
    static decode(data: ArrayBuffer | Uint8Array, options: DecodeOptions): DecodedAudio | DecodedAudio<Int16Array>;
}
