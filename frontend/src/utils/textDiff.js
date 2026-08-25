export function normalizeAnswer(value) {
  return value.trim().normalize('NFC')
}

function graphemes(value) {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), (item) => item.segment)
  }
  return Array.from(value)
}

function append(parts, type, value) {
  const previous = parts[parts.length - 1]
  if (previous?.type === type) previous.text += value
  else parts.push({ type, text: value })
}

export function diffText(actualValue, expectedValue) {
  const actual = graphemes(normalizeAnswer(actualValue))
  const expected = graphemes(normalizeAnswer(expectedValue))
  const table = Array.from({ length: actual.length + 1 }, () => Array(expected.length + 1).fill(0))

  for (let i = actual.length - 1; i >= 0; i -= 1) {
    for (let j = expected.length - 1; j >= 0; j -= 1) {
      table[i][j] = actual[i] === expected[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const parts = []
  let i = 0; let j = 0
  while (i < actual.length || j < expected.length) {
    if (i < actual.length && j < expected.length && actual[i] === expected[j]) {
      append(parts, 'equal', actual[i]); i += 1; j += 1
    } else if (j < expected.length && (i >= actual.length || table[i][j + 1] >= table[i + 1][j])) {
      append(parts, 'insert', expected[j]); j += 1
    } else {
      append(parts, 'delete', actual[i]); i += 1
    }
  }
  return parts
}
