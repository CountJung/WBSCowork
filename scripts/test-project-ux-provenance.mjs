/** Deterministic fingerprint of immutable test inputs, excluding all output directories. */
import {createHash} from 'node:crypto';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
export async function buildSnapshot(roots){
  const files=[];
  async function visit(file){
    if((await stat(file)).isDirectory())for(const name of (await readdir(file)).sort())await visit(path.join(file,name));
    else files.push(file);
  }
  for(const root of roots)await visit(root);
  const hash=createHash('sha256');let bytes=0;
  for(const file of files.sort()){const value=await readFile(file);bytes+=value.length;hash.update(file.replaceAll(path.sep,'/'));hash.update('\0');hash.update(value);hash.update('\0');}
  return {sha256:hash.digest('hex'),files:files.length,bytes};
}
