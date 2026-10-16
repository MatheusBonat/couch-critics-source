// Gera o pacote para o portal do Root, leve e sem segredos.
//
// Por que não empacotar a pasta do projeto direto: o empacotador do Root copia node_modules por inteiro. Aqui isso
// levava ~13 mil arquivos e 300 MB descompactados (typescript, vite, esbuild, o protoc de 100 MB, o plugin do protobuf,
// ícones do cliente...), tudo de desenvolvimento, mais o server/.env (DEV_TOKEN) e o banco de testes por causa do atalho
// node_modules/@notas-app/server. Pacote desse tamanho passou a estourar o tempo do portal (HTTP 524 no envio) e o Root
// ficou com versões sem o código novo e o app indisponível.
//
// Então o pacote sai de uma pasta de montagem temporária com SÓ o que o servidor usa:
//   - o manifesto, server/dist, networking/gen/server e client/dist;
//   - em node_modules, apenas as dependências de produção do servidor (calculadas a partir de server/package.json e do
//     SDK do servidor, seguindo as dependências de cada pacote). A pasta do próprio sqlite3 e o @rootsdk/dev-tools ficam de
//     fora, como o empacotador do Root já faz (o Root fornece o sqlite3 no servidor dele), MAS as dependências do sqlite3
//     (bindings etc.) entram: o sqlite3 do Root as carrega do node_modules do pacote. Sem elas o servidor não sobe e o app
//     fica indisponível.
// No fim, confere o conteúdo do pacote (sem .env nem banco de dados) e apaga a pasta temporária.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "rootapp.pkg");
const forbidden = /(^|\/)\.env(\.|$)|\.sqlite3?(-journal|-wal|-shm)?$/;
// O empacotador do Root exclui estes dois do node_modules. O sqlite3 é percorrido (para levar as dependências dele) e só a
// pasta dele é tirada da montagem; o @rootsdk/dev-tools nem é percorrido.
const providedByRoot = new Set(["@rootsdk/dev-tools"]);
const leftOutOfStage = new Set(["sqlite3"]);
const runtimeRoots = ["@rootsdk/server-app", "@notas-app/gen-server", "@notas-app/gen-shared"];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Acha a pasta real de um pacote como o Node acharia: de dentro para fora, a partir da pasta que o pede.
function locate(name, from) {
  let dir = from;
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return fs.realpathSync(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Todos os pacotes que o servidor carrega em produção (dependências, opcionais e peers instalados), seguindo o grafo.
function productionClosure() {
  const found = new Map(); // pasta real -> nome
  const queue = [...Object.keys(readJson(path.join(root, "server/package.json")).dependencies ?? {}), ...runtimeRoots].map((name) => [name, root]);

  while (queue.length > 0) {
    const [name, from] = queue.pop();
    if (providedByRoot.has(name)) continue;
    const real = locate(name, from);
    if (!real || found.has(real)) continue; // peer opcional que não está instalado (ex.: pg-query-stream) é normal
    found.set(real, name);

    const pkg = readJson(path.join(real, "package.json"));
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) queue.push([dep, real]);
  }
  return found;
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), "couch-package-"));
let exitCode = 1;

try {
  const copy = (from, to, filter) => fs.cpSync(path.join(root, from), path.join(stage, to ?? from), { recursive: true, dereference: true, filter });
  const notNodeModules = (source) => path.basename(source) !== "node_modules";

  copy("root-manifest.json");
  copy("server/dist");
  copy("client/dist");
  copy("networking/gen/server", undefined, notNodeModules);

  // node_modules: só o que o servidor usa. Pacote de node_modules/ (primeiro nível) é copiado inteiro, com os node_modules aninhados dele.
  const modulesRoot = path.join(root, "node_modules");
  const copied = new Set();
  for (const [real, name] of productionClosure()) {
    const relative = path.relative(modulesRoot, real).replace(/\\/g, "/");
    const inside = !relative.startsWith("..");
    // Dentro de node_modules vale o primeiro nível (ou @escopo/nome); atalhos de workspace (@notas-app/*) valem pelo nome.
    const top = inside ? relative.split("/").slice(0, relative.startsWith("@") ? 2 : 1).join("/") : name;
    if (copied.has(top) || leftOutOfStage.has(top)) continue;
    copied.add(top);
    fs.cpSync(inside ? path.join(modulesRoot, top) : real, path.join(stage, "node_modules", top), { recursive: true, dereference: true, filter: inside ? undefined : notNodeModules });
  }
  console.log(`Montagem: ${copied.size} pacotes de produção em node_modules (o resto do node_modules é só de desenvolvimento).`);

  fs.rmSync(output, { force: true });
  const build = spawnSync("npx", ["rootsdk", "build", "package", "--output-file", output, "--project-folder", stage], { cwd: root, stdio: "inherit", shell: true });
  if (build.status !== 0) throw new Error("O empacotamento falhou.");

  // Confere o que entrou no pacote (o pacote tem client.tar.gz e server.tar.gz dentro).
  const listing = spawnSync("tar -xOf rootapp.pkg server.tar.gz | tar -tzf -", { cwd: root, shell: true, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  if (listing.status !== 0) throw new Error("Não consegui listar o pacote para conferir.");
  const files = listing.stdout.split(/\r?\n/).filter(Boolean);
  const leaked = files.filter((line) => forbidden.test(line));
  if (leaked.length > 0) {
    fs.rmSync(output, { force: true });
    throw new Error("O pacote levaria arquivos secretos e foi apagado:\n" + leaked.join("\n"));
  }
  const megabytes = (fs.statSync(output).size / 1e6).toFixed(1);
  console.log(`Pacote conferido: sem .env e sem banco de dados. ${files.length} arquivos no servidor, ${megabytes} MB.`);
  exitCode = 0;
} catch (error) {
  console.error(error.message);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
process.exit(exitCode);
