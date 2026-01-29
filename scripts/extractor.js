import { JSDOM } from 'jsdom';

export function getJsonSchema(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const items = document.querySelectorAll('.campo-xml-item');
    
    const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": document.querySelector('title').textContent,
        "type": "object",
        "properties": {}
    };

    const jsonFake = {};

    const jsonDocs = {
        obrigatorios: {},
        ignorados: {},
        opcionais: {}
    };

    items.forEach(item => {
        const pathElem = item.querySelector('.json-path');
        if (!pathElem) return;

        // Extração de dados
        const fullPath = pathElem.textContent.replace('$.', '');
        const title = item.querySelector('h6')?.textContent.trim() || "";
        const description = item.querySelector('.text-body-secondary.small')?.textContent.trim() || "";
        
        const isRequired = !!item.querySelector('.badge-obrigatoriedade.badge-orange-municipio');
        const mustIgnore = !!item.querySelector('.badge-obrigatoriedade.bg-dark');

        const pathParts = fullPath.split('.');
        let currentLevel = schema;
        let currentFakeLevel = jsonFake;

        const fullJsonPath = '$.' + fullPath;
        const docText = description || title;

        pathParts.forEach((part, index) => {
            const isLast = index === pathParts.length - 1;

            if (!currentLevel.properties) currentLevel.properties = {};

            if (isLast) {
                currentLevel.properties[part] = {
                    ...currentLevel.properties[part],
                    "title": title,
                    "description": description,
                    "type": currentLevel.properties[part]?.type || "string"
                };

                const fieldType = currentLevel.properties[part].type;
                if (fieldType === "string") {
                    currentFakeLevel[part] = "string";
                } else if (fieldType === "number" || fieldType === "integer") {
                    currentFakeLevel[part] = 0;
                } else if (fieldType === "boolean") {
                    currentFakeLevel[part] = true;
                } else if (fieldType === "array") {
                    currentFakeLevel[part] = [];
                } else if (fieldType === "object") {
                    currentFakeLevel[part] = {};
                } else {
                    currentFakeLevel[part] = "string";
                }

                if (isRequired) {
                    if (!currentLevel.required) currentLevel.required = [];
                    if (!currentLevel.required.includes(part)) {
                        currentLevel.required.push(part);
                    }
                    jsonDocs.obrigatorios[fullJsonPath] = docText;
                } else if (mustIgnore) {
                    if (!currentLevel.ignore) currentLevel.ignore = [];
                    if (!currentLevel.ignore.includes(part)) {
                        currentLevel.ignore.push(part);
                    }
                    jsonDocs.ignorados[fullJsonPath] = docText;
                } else {
                    if (!currentLevel.optional) currentLevel.optional = [];
                    if (!currentLevel.optional.includes(part)) {
                        currentLevel.optional.push(part);
                    }
                    jsonDocs.opcionais[fullJsonPath] = docText;
                }
            } else {
                if (!currentLevel.properties[part]) {
                    currentLevel.properties[part] = {
                        "type": "object",
                        "properties": {}
                    };
                }
                if (!currentFakeLevel[part] || typeof currentFakeLevel[part] !== 'object' || Array.isArray(currentFakeLevel[part])) {
                    currentFakeLevel[part] = {};
                }
                currentLevel = currentLevel.properties[part];
                currentFakeLevel = currentFakeLevel[part];
            }
        });
    });

    return {
        schema,
        jsonFake,
        jsonDocs,
        sample_json: document.querySelector('.json-box code').innerHTML
    };
}