/**
 * Stereo downmix: average left + right channels.
 *
 * Input:  Int16Array of 960 values — 480 stereo pairs (L0,R0,L1,R1,…) at 48kHz
 * Output: Int16Array of 480 values — mono at 48kHz
 */
export function downmixToMono(stereo: Int16Array): Int16Array {
  const mono = new Int16Array(stereo.length >> 1);
  for (let i = 0; i < mono.length; i++) {
    mono[i] = (stereo[2 * i] + stereo[2 * i + 1]) >> 1;
  }
  return mono;
}
