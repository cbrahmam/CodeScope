const EXTENSION_MAP = {
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  go: 'go',
  rs: 'rust',
  java: 'java',
  rb: 'ruby',
  cpp: 'cpp',
  cc: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'shell',
  bash: 'shell',
}

const LANGUAGE_LABELS = {
  python: { label: 'Python', color: 'bg-blue-500' },
  javascript: { label: 'JavaScript', color: 'bg-yellow-500' },
  typescript: { label: 'TypeScript', color: 'bg-blue-600' },
  jsx: { label: 'JSX', color: 'bg-cyan-500' },
  tsx: { label: 'TSX', color: 'bg-cyan-600' },
  go: { label: 'Go', color: 'bg-sky-400' },
  rust: { label: 'Rust', color: 'bg-orange-600' },
  java: { label: 'Java', color: 'bg-red-500' },
  ruby: { label: 'Ruby', color: 'bg-red-600' },
  cpp: { label: 'C++', color: 'bg-purple-500' },
  c: { label: 'C', color: 'bg-purple-400' },
  sql: { label: 'SQL', color: 'bg-green-500' },
  html: { label: 'HTML', color: 'bg-orange-500' },
  css: { label: 'CSS', color: 'bg-pink-500' },
  json: { label: 'JSON', color: 'bg-gray-500' },
  yaml: { label: 'YAML', color: 'bg-gray-400' },
  shell: { label: 'Shell', color: 'bg-green-600' },
  plaintext: { label: 'Plain Text', color: 'bg-gray-600' },
}

const HEURISTICS = [
  [/^\s*(?:from\s+\S+\s+)?import\s+\S+/m, 'python'],
  [/^\s*def\s+\w+\s*\(/m, 'python'],
  [/^\s*class\s+\w+.*:\s*$/m, 'python'],
  [/(?:import\s+.*\s+from\s+['"]|require\s*\()/, 'javascript'],
  [/(?:const|let|var)\s+\w+\s*=/, 'javascript'],
  [/function\s+\w+\s*\(/, 'javascript'],
  [/interface\s+\w+\s*\{/, 'typescript'],
  [/:\s*(?:string|number|boolean|void)\b/, 'typescript'],
  [/<[A-Z]\w+[\s/>]/, 'jsx'],
  [/^\s*func\s+\w+\s*\(/m, 'go'],
  [/^\s*package\s+\w+/m, 'go'],
  [/^\s*fn\s+\w+\s*\(/m, 'rust'],
  [/^\s*(?:pub\s+)?(?:struct|enum|impl)\s+/m, 'rust'],
  [/^\s*(?:public|private|protected)\s+class\s+/m, 'java'],
  [/^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\b/im, 'sql'],
  [/<!DOCTYPE\s+html|<html/i, 'html'],
  [/^\s*(?:body|div|\.[\w-]+|#[\w-]+)\s*\{/m, 'css'],
]

export function detectLanguage(filename, content = '') {
  if (filename) {
    const parts = filename.split('.')
    if (parts.length > 1) {
      const ext = parts.pop().toLowerCase()
      if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext]
    }
  }

  const sample = content.split('\n').slice(0, 50).join('\n')
  for (const [pattern, lang] of HEURISTICS) {
    if (pattern.test(sample)) return lang
  }

  return 'plaintext'
}

export function getLanguageInfo(language) {
  return LANGUAGE_LABELS[language] || LANGUAGE_LABELS.plaintext
}

export function getMonacoLanguage(language) {
  const map = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    go: 'go',
    rust: 'rust',
    java: 'java',
    ruby: 'ruby',
    cpp: 'cpp',
    c: 'c',
    sql: 'sql',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    shell: 'shell',
    plaintext: 'plaintext',
  }
  return map[language] || 'plaintext'
}
