import cidades from '../data/cidades.json' with  { type: 'json' }
import cidadesClientes from '../data/cidades-clientes.json' with  { type: 'json' }

import { getJsonSchema } from './extractor.js';
import { getJsonSchemaFromBlog, detectDocumentationType, getHtmlSection } from './extractor-blog.js';
import { generateCityDoc } from './generate-city-doc.js';
import fs from 'fs';

let fullSampleJson = {};
let fullSchemaJson = {};
let fullDocsJson = {
    obrigatorios: {},
    ignorados: {},
    opcionais: {}
};
let docsGeneratedCount = 0;
let docsFailedCount = 0;

const promises = cidadesClientes.map(async x => {
    var cidade = cidades.find(y => y.slug === x);

    if (!cidade) {
        console.log('Cidade não encontrada: ' + x);
        return;
    }

    createDirectoryIfNotExists('./work');
    createDirectoryIfNotExists('./work/guides');
    createDirectoryIfNotExists('./work/blogs');

    const { url, response } = await fetchWithManualFollowRedirects(cidade.url);
    if (!response.ok) {
        console.log('Erro ao buscar schema: ' + x);
        return;
    }
    
    const html = await response.text();
    
    const docType = detectDocumentationType(url);
    let schema;
    
    if (docType === 'guide') {
        createDirectoryIfNotExists(`./work/guides/${x}`);
        const res = getJsonSchema(html);
        schema = res.schema;
        fs.writeFileSync(`./work/guides/${x}/${x}-schema.json`, JSON.stringify(schema, null, 2));
        fs.writeFileSync(`./work/guides/${x}/${x}-sample.json`, res.sample_json);
        fs.writeFileSync(`./work/guides/${x}/${x}-json-fake.json`, JSON.stringify(res.jsonFake, null, 2));
        fs.writeFileSync(`./work/guides/${x}/${x}-json-docs.json`, JSON.stringify(res.jsonDocs, null, 2));
        fs.writeFileSync(`./work/guides/${x}/${x}-response.html`, html);
        fs.writeFileSync(`./work/guides/${x}/${x}-metadata.json`, JSON.stringify({ ...cidade, url }, null, 2));

        fullSampleJson = { ...fullSampleJson, ...tryParseJson(res.sample_json, x) };
        fullSchemaJson = { ...fullSchemaJson, ...res.jsonFake };
        fullDocsJson.obrigatorios = { ...fullDocsJson.obrigatorios, ...res.jsonDocs.obrigatorios };
        fullDocsJson.ignorados = { ...fullDocsJson.ignorados, ...res.jsonDocs.ignorados };
        fullDocsJson.opcionais = { ...fullDocsJson.opcionais, ...res.jsonDocs.opcionais };

        try {
            generateCityDoc(x, { verbose: false, basePath: '.' });
            docsGeneratedCount++;
            console.log(`✅ Documentação gerada para: ${x}`);
        } catch (error) {
            docsFailedCount++;
            console.warn(`⚠️  Não foi possível gerar documentação para ${x}: ${error.message}`);
        }

    } else if (docType === 'blog') {
        createDirectoryIfNotExists(`./work/blogs/${x}`);
        const focused = getHtmlSection(html);
        fs.writeFileSync(`./work/blogs/${x}/${x}-focused.html`, focused);

        schema = getJsonSchemaFromBlog(html);
        fs.writeFileSync(`./work/blogs/${x}/${x}-schema-from-blog.json`, JSON.stringify(schema, null, 2));
        fs.writeFileSync(`./work/blogs/${x}/${x}-response.html`, html);
        fs.writeFileSync(`./work/blogs/${x}/${x}-metadata.json`, JSON.stringify({ ...cidade, url }, null, 2));
    } else {
        console.log(`Tipo de documentação desconhecido para: ${x} (${url})`);
        return;
    }

    schema.$meta = {
        ...cidade,
        url,
        docType
    };

    return schema;
});

Promise.all(promises).then(() => {
    fs.writeFileSync('./work/cities-full-sample.json', JSON.stringify(fullSampleJson, null, 2));
    fs.writeFileSync('./work/cities-full-schema.json', JSON.stringify(fullSchemaJson, null, 2));
    fs.writeFileSync('./work/cities-full-docs.json', JSON.stringify(fullDocsJson, null, 2));
    
    console.log('\n📋 Resumo da Geração de Documentação:');
    console.log(`   ✅ Documentações geradas: ${docsGeneratedCount}`);
    if (docsFailedCount > 0) {
        console.log(`   ⚠️  Falhas: ${docsFailedCount}`);
    }
    console.log(`   📊 Total processado: ${docsGeneratedCount + docsFailedCount}\n`);
});

function createDirectoryIfNotExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

async function fetchWithManualFollowRedirects(url) {
    const response = await fetch(url, { redirect: 'manual' });
    
    if ([301, 302, 307, 308].includes(response.status)) {
        return fetchWithManualFollowRedirects('https://focusnfe.com.br' + response.headers.get('Location'));
    }

    return { url, response };
}

function tryParseJson(raw, cidade) {
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.log('Erro ao parsear JSON para ' + cidade);
        return { erros: { [cidade]: e.message }};
    }
}