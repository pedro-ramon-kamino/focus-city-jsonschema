import fs from 'fs';
import path from 'path';

function usageAndExit() {
  console.error('Usage: node ./scripts/generate-city-doc.js <city_slug>');
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeType(schemaNode) {
  if (!schemaNode || typeof schemaNode !== 'object') return 'string';

  if (Array.isArray(schemaNode.enum)) return 'enum';

  // Some extracted schemas mistakenly mark objects as "string" while still having "properties".
  if (schemaNode.properties && typeof schemaNode.properties === 'object') return 'object';

  if (schemaNode.type) return schemaNode.type;

  return 'string';
}

function isReformaTributaria(description) {
  if (!description) return false;
  const text = String(description);
  return text.includes('<sup>(RT)</sup>') || /reforma\s+tribut[aá]ria/i.test(text);
}

function setNested(target, parts, leafValue) {
  let cur = target;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    if (isLast) {
      cur[part] = leafValue;
      return;
    }

    if (!cur[part] || typeof cur[part] !== 'object' || Array.isArray(cur[part])) {
      cur[part] = {};
    }

    cur = cur[part];
  }
}

function extractSchemaPaths(schemaNode, prefix = '') {
  const out = [];

  if (!schemaNode || typeof schemaNode !== 'object') return out;

  const properties = schemaNode.properties;
  if (!properties || typeof properties !== 'object') return out;

  for (const [key, value] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    out.push({
      path: fieldPath,
      node: value
    });

    if (value && typeof value === 'object' && value.properties) {
      out.push(...extractSchemaPaths(value, fieldPath));
    }
  }

  return out;
}

function extractStandardPathsFromMunicipal(padraoMunicipal) {
  const requestSchema = padraoMunicipal?.data?.api?.schema?.paths?.['/nfse']?.post?.requestBody?.content?.['application/json']?.schema;
  if (!requestSchema) return new Set();

  const all = [];
  const stack = [{ node: requestSchema, prefix: '' }];

  while (stack.length) {
    const { node, prefix } = stack.pop();
    if (!node || typeof node !== 'object') continue;

    const props = node.properties;
    if (!props || typeof props !== 'object') continue;

    for (const [k, v] of Object.entries(props)) {
      const p = prefix ? `${prefix}.${k}` : k;
      all.push(p);
      if (v && typeof v === 'object' && v.properties) {
        stack.push({ node: v, prefix: p });
      }
    }
  }

  return new Set(all);
}

function extractStandardPathsFromNacional(padraoNacional) {
  const requestSchema = padraoNacional?.data?.api?.schema?.paths?.['/nfsen']?.post?.requestBody?.content?.['application/json']?.schema;
  if (!requestSchema) return new Set();

  const all = [];
  const stack = [{ node: requestSchema, prefix: '' }];

  while (stack.length) {
    const { node, prefix } = stack.pop();
    if (!node || typeof node !== 'object') continue;

    const props = node.properties;
    if (!props || typeof props !== 'object') continue;

    for (const [k, v] of Object.entries(props)) {
      const p = prefix ? `${prefix}.${k}` : k;
      all.push(p);
      if (v && typeof v === 'object' && v.properties) {
        stack.push({ node: v, prefix: p });
      }
    }
  }

  return new Set(all);
}

function buildDocForCity({ citySchema, cityDocs, standardMunicipalPaths, standardNacionalPaths }) {
  const out = {};

  const requiredPaths = new Set(Object.keys(cityDocs?.obrigatorios ?? {}));
  const ignoredPaths = new Set(Object.keys(cityDocs?.ignorados ?? {}));

  const schemaPaths = extractSchemaPaths(citySchema);

  const stats = {
    total: schemaPaths.length,
    obrigatorios: 0,
    proibidos: 0,
    mapeadosNFSe: 0,
    mapeadosNacional: 0,
    exclusivos: 0,
    reformaTributaria: 0
  };

  for (const { path: schemaPath, node } of schemaPaths) {
    const jsonPath = `$.${schemaPath}`;

    const required = requiredPaths.has(jsonPath);
    const proibido = ignoredPaths.has(jsonPath);

    if (required) stats.obrigatorios++;
    if (proibido) stats.proibidos++;

    const type = normalizeType(node);
    
    let description = node?.description ?? '';
    if (!description) {
      description = cityDocs?.opcionais?.[jsonPath] ?? cityDocs?.obrigatorios?.[jsonPath] ?? '';
    }

    const normalizedPath = schemaPath.replace(/\[\]/g, '');
    const mapeadoNFSe = standardMunicipalPaths.has(normalizedPath) || standardMunicipalPaths.has(schemaPath);
    const mapeadoNacional = standardNacionalPaths.has(normalizedPath) || standardNacionalPaths.has(schemaPath);
    const reformaTributaria = isReformaTributaria(description);

    if (mapeadoNFSe) stats.mapeadosNFSe++;
    if (mapeadoNacional) stats.mapeadosNacional++;
    if (!mapeadoNFSe && !mapeadoNacional) stats.exclusivos++;
    if (reformaTributaria) stats.reformaTributaria++;

    const leaf = {
      type,
      ...(Array.isArray(node?.enum) ? { values: node.enum } : {}),
      description,
      ...(mapeadoNFSe ? { mapeadoNFSe: true } : {}),
      ...(mapeadoNacional ? { mapeadoNacional: true } : {}),
      required,
      proibido,
      ...(reformaTributaria ? { reformaTributaria: true } : {})
    };

    setNested(out, schemaPath.split('.'), leaf);
  }

  console.log('\n📊 Estatísticas:');
  console.log(`   Total de campos: ${stats.total}`);
  console.log(`   Obrigatórios: ${stats.obrigatorios}`);
  console.log(`   Proibidos: ${stats.proibidos}`);
  console.log(`   Mapeados NFSe: ${stats.mapeadosNFSe}`);
  console.log(`   Mapeados Nacional: ${stats.mapeadosNacional}`);
  console.log(`   Exclusivos da cidade: ${stats.exclusivos}`);
  console.log(`   Reforma Tributária: ${stats.reformaTributaria}`);

  return out;
}

export function generateCityDoc(citySlug, options = {}) {
  const { verbose = true, basePath = '.' } = options;

  if (verbose) {
    console.log(`\n🏙️  Gerando documentação para: ${citySlug}`);
  }

  const guidesDir = path.join(basePath, 'work', 'guides', citySlug);
  const schemaPath = path.join(guidesDir, `${citySlug}-schema.json`);
  const docsPath = path.join(guidesDir, `${citySlug}-json-docs.json`);

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }
  if (!fs.existsSync(docsPath)) {
    throw new Error(`Docs not found: ${docsPath}`);
  }

  if (verbose) console.log('📖 Lendo arquivos da cidade...');
  const citySchema = readJson(schemaPath);
  const cityDocs = readJson(docsPath);

  if (!citySchema.properties || typeof citySchema.properties !== 'object') {
    throw new Error('Schema inválido: não possui propriedades na raiz');
  }

  if (verbose) console.log('📚 Carregando padrões de referência...');
  const padraoMunicipal = readJson(path.join(basePath, 'data', 'padrao-municipal.json'));
  const padraoNacional = readJson(path.join(basePath, 'data', 'padrao-nacioanal.json'));

  const standardMunicipalPaths = extractStandardPathsFromMunicipal(padraoMunicipal);
  const standardNacionalPaths = extractStandardPathsFromNacional(padraoNacional);

  if (verbose) {
    if (standardMunicipalPaths.size === 0) {
      console.warn('⚠️  Warning: Nenhum campo extraído do padrão municipal');
    } else {
      console.log(`   Padrão Municipal: ${standardMunicipalPaths.size} campos`);
    }

    if (standardNacionalPaths.size === 0) {
      console.warn('⚠️  Warning: Nenhum campo extraído do padrão nacional');
    } else {
      console.log(`   Padrão Nacional: ${standardNacionalPaths.size} campos`);
    }

    console.log('\n⚙️  Processando campos...');
  }

  const doc = buildDocForCity({
    citySchema,
    cityDocs,
    standardMunicipalPaths,
    standardNacionalPaths
  });

  const outPath = path.join(guidesDir, 'doc.json');
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));

  if (verbose) {
    console.log(`\n✅ Gerado com sucesso: ${outPath}\n`);
  }

  return { doc, outPath };
}

function main() {
  const citySlug = process.argv[2];
  if (!citySlug) usageAndExit();

  try {
    generateCityDoc(citySlug);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main();
}
