// Node test runner reporter that turns failures into GitHub Actions
// annotations, so they show up on the PR and in the checks API.
// Used in CI next to the normal spec reporter.
const escape = (text) =>
  String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

export default async function* githubReporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:fail') continue;
    const { name, file, line, details } = event.data;
    const error = details?.error?.cause ?? details?.error;
    const message = [error?.message, error?.stack?.split('\n').slice(1, 4).join('\n')]
      .filter(Boolean)
      .join('\n');
    const where = file ? `file=${file.replace(/^file:\/\//, '')},line=${line ?? 1},` : '';
    yield `::error ${where}title=${escape(name)}::${escape(message || 'test failed')}\n`;
  }
}
