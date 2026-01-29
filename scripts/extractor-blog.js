import { JSDOM } from 'jsdom';

export function getHtmlSection (html) {
    const dom = new JSDOM(html);
    const document = dom.window.document.querySelector('.post-content');
    if (document) {
        return document.innerHTML;
    }
    
    return dom.window.document.querySelector('body').innerHTML;
}


export function getJsonSchemaFromBlog(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Schema NFSe - Blog Format",
        "type": "object",
        "properties": {},
        "blogFormat": true
    };

    // Extrair todo o texto do body para análise
    const bodyText = document.body ? document.body.textContent : '';
    
    let dadosBasicos = {};
    let camposAPI = {};
    let observacoes = '';
    
    // Tentar encontrar seções no texto completo
    const sections = {
        dadosBasicos: /Dados básicos:([\s\S]*?)(?=Campos em nossa API:|Observações:|$)/i,
        camposAPI: /Campos em nossa API:([\s\S]*?)(?=Observações:|Dados básicos:|$)/i,
        observacoes: /Observações:([\s\S]*?)(?=Dados básicos:|Campos em nossa API:|$)/i
    };
    
    // Extrair Dados Básicos
    const dadosMatch = bodyText.match(sections.dadosBasicos);
    if (dadosMatch) {
        const text = dadosMatch[1];
        const lines = text.split('\n').filter(l => l.trim());
        for (const line of lines) {
            if (line.includes(':')) {
                const colonIndex = line.indexOf(':');
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                if (key && value) {
                    const cleanKey = key.toLowerCase().replace(/\s+/g, '_');
                    dadosBasicos[cleanKey] = value;
                }
            }
        }
    }
    
    // Extrair Campos em nossa API
    const camposMatch = bodyText.match(sections.camposAPI);
    if (camposMatch) {
        const text = camposMatch[1];
        const lines = text.split('\n').filter(l => l.trim());
        for (const line of lines) {
            if (line.includes(':')) {
                const colonIndex = line.indexOf(':');
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                
                if (key && value && !key.toLowerCase().includes('campos em nossa api')) {
                    // Identificar se é obrigatório
                    const isRequired = value.toLowerCase().includes('obrigatório');
                    
                    // Extrair descrição
                    let description = value;
                    if (isRequired) {
                        description = value.replace(/obrigatório\.?\s*/i, '').trim();
                    }
                    
                    camposAPI[key] = {
                        description,
                        required: isRequired
                    };
                }
            }
        }
    }
    
    // Extrair Observações
    const obsMatch = bodyText.match(sections.observacoes);
    if (obsMatch) {
        observacoes = obsMatch[1].trim();
    }
    
    // Construir schema baseado nos campos da API
    for (const [fieldName, fieldInfo] of Object.entries(camposAPI)) {
        const fieldKey = fieldName.toLowerCase().replace(/\s+/g, '_');
        
        schema.properties[fieldKey] = {
            "title": fieldName,
            "description": fieldInfo.description,
            "type": "string"
        };
        
        if (fieldInfo.required) {
            if (!schema.required) {
                schema.required = [];
            }
            schema.required.push(fieldKey);
        }
    }
    
    // Adicionar metadados extraídos
    schema.$blogMeta = {
        dadosBasicos,
        camposAPI,
        observacoes
    };
    
    return schema;
}

export function detectDocumentationType(url) {
    if (url.includes('/guides/nfse/municipios-integrados/')) {
        return 'guide';
    } else if (url.includes('/blog/')) {
        return 'blog';
    }
    return 'unknown';
}
