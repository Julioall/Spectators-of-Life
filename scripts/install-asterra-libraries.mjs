/**
 * Instala os pacotes ASTERRA v0.2.0 (fornecidos no kit ZIP) como npm workspaces.
 * Não modifica código do Worker, schema de save ou arquivos dos pacotes.
 * Executar na raiz do Spectators-of-Life e depois npm install + npm run check.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd(),manifestPath=join(root,'package.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if(manifest.name!=='spectators-of-life')
 throw new Error('Execute na raiz do repositório Spectators-of-Life.');
const names=['wind','leaves','vegetation','trees','rocks'];
for(const name of names){
 const folder=join(root,'vendor','asterra-libs','packages','asterra-'+name);
 if(!existsSync(join(folder,'package.json')))
  throw new Error('Biblioteca ausente: '+folder+' (extraia o kit de integração primeiro).');
}
manifest.workspaces=[...new Set([...(manifest.workspaces||[]),'vendor/asterra-libs/packages/*'])];
manifest.dependencies={...(manifest.dependencies||{})};
for(const name of names)
 manifest.dependencies['@asterra/'+name]='file:vendor/asterra-libs/packages/asterra-'+name;
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Workspaces ASTERRA incluídos. Execute npm install e npm run check; comite também package-lock.json.');
