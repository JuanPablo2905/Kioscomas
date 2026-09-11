import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
};

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const releases = JSON.parse(fs.readFileSync(path.join("release-notes", "releases.json"), "utf8"));
const version = String(argument("--version") || packageJson.version).replace(/^v/, "");
const release = releases.find((item) => item.version === version);

if (!release) throw new Error(`Faltan las notas de la versión ${version} en release-notes/releases.json.`);

const lines = [
  `# ${release.title}`,
  "",
  release.summary,
  "",
  ...release.sections.flatMap((section) => [
    `## ${section.title}`,
    "",
    ...section.items.map((item) => `- ${item}`),
    "",
  ]),
  `Fecha: ${release.date}`,
  "",
];
const markdown = lines.join("\n");
const output = argument("--output");

if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, markdown, "utf8");
  console.log(`Notas de la versión ${version} preparadas en ${output}`);
} else {
  process.stdout.write(markdown);
}
