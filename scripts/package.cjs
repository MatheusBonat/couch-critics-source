// Gera o pacote para o portal do Root sem levar segredos.
//
// O empacotador copia node_modules por inteiro, e node_modules/@notas-app/server é um atalho para a
// pasta server/. Sem este cuidado, o pacote leva o server/.env (DEV_TOKEN) e o banco de testes
// (server/rootsdk.sqlite3, que guarda as chaves de API coladas na tela de Configurações).
// Este script tira esses arquivos do lugar, empacota, confere o pacote e os devolve no fim.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const output = "rootapp.pkg";
const secrets = ["server/.env", "server/rootsdk.sqlite3", "server/rootsdk.sqlite3-journal", "server/rootsdk.sqlite3-wal", "server/rootsdk.sqlite3-shm"];
const forbidden = /(^|\/)\.env(\.|$)|\.sqlite3?(-journal|-wal|-shm)?$/;

const stash = fs.mkdtempSync(path.join(os.tmpdir(), "couch-package-"));
const moved = [];
let exitCode = 1;

function restore() {
  for (const [from, to] of moved.reverse()) {
    try {
      fs.renameSync(to, from);
    } catch (error) {
      console.error(`ATENÇÃO: não consegui devolver ${from}. Ele está em ${to}.`, error.message);
    }
  }
}

try {
  for (const relative of secrets) {
    const from = path.join(root, relative);
    if (!fs.existsSync(from)) continue;
    const to = path.join(stash, relative.replace(/\//g, "__"));
    fs.renameSync(from, to); // se o servidor de teste estiver rodando, falha aqui e nada é empacotado
    moved.push([from, to]);
    console.log(`Tirado do lugar durante o empacotamento: ${relative}`);
  }

  fs.rmSync(path.join(root, output), { force: true });
  const build = spawnSync("npx", ["rootsdk", "build", "package", "--output-file", `./${output}`, "--project-folder", "."], { cwd: root, stdio: "inherit", shell: true });
  if (build.status !== 0) throw new Error("O empacotamento falhou.");

  // Confere o que entrou no pacote (o pacote tem client.tar.gz e server.tar.gz dentro).
  const listing = spawnSync(`tar -xOf ${output} server.tar.gz | tar -tzf -`, { cwd: root, shell: true, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  if (listing.status !== 0) throw new Error("Não consegui listar o pacote para conferir.");
  const leaked = listing.stdout.split(/\r?\n/).filter((line) => forbidden.test(line));
  if (leaked.length > 0) {
    fs.rmSync(path.join(root, output), { force: true });
    throw new Error("O pacote levaria arquivos secretos e foi apagado:\n" + leaked.join("\n"));
  }
  console.log(`Pacote conferido: sem .env e sem banco de dados. ${listing.stdout.split(/\r?\n/).filter(Boolean).length} arquivos no servidor.`);
  exitCode = 0;
} catch (error) {
  console.error(error.message);
} finally {
  restore();
  try {
    fs.rmdirSync(stash);
  } catch {
    // Sobrou algum arquivo que não voltou: a mensagem acima diz onde.
  }
}
process.exit(exitCode);
