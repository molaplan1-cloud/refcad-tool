// Touch on a drawing: a short tap places or selects, a drag pans when the
// hand is active or no draw tool is armed, and two fingers pinch. A draw tool
// keeps one-finger taps for placement so a wall does not turn into a pan.

export function touchAction({ pointerType = 'mouse', pointers = 1, hand = false, drawing = false, moved = false, longPress = false } = {}) {
  if (pointerType !== 'touch') return 'mouse'
  if (pointers >= 2) return 'pinch'
  if (hand || longPress) return 'pan'
  if (!drawing) return moved ? 'pan' : 'tap'
  return moved ? 'ignore' : 'tap'
}
