#!/usr/bin/osascript -l JavaScript

ObjC.import('Foundation');

function run(paths) {
  paths.forEach(path => {
    const source = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null).js
      .replace(/^#![^\n]*\n/, '')
      .replace(/^\s*import\s+[^;\n]+;?\s*$/gm, '')
      .replace(/import\.meta/g, '({ url: "file://local" })');
    try {
      new Function(source);
    } catch (error) {
      throw new Error(`${path}: ${error.message}`);
    }
  });
  return `Syntaxe JavaScript valide : ${paths.length} fichier(s).`;
}
