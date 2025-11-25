const sheetURL = 'https://docs.google.com/spreadsheets/d/1J863KkwBSfCvh8cfnNCoK9XO82gS8_0LneSFWJFYuyM/export?format=csv';
const metadataGid = "947089910"
// const sheetURL = '';

const sheetConfigs = {
    "Palestras": {
        gid: "0",
        columnsSearch: ["#", "ÁREA", "DATA", "LOCAL", "CLASSE", "TEMA", "PALESTRA", "ÁREA"],
        columnsWide: ["#", "DATA", "LOCAL","TEMA", "PALESTRA"],
        columnsSmall: ["#", "PALESTRA"],
    },
    "Mapas Mentais": {
        gid: "1154666289",
        columnsSearch: ["#", "SÉRIE", "AUTORES", "NOME"],
        columnsWide: ["#", "SÉRIE", "AUTORES", "NOME"],
        columnsSmall: ["#", "NOME"],
    },
    "Minutagem de Lives": {
        gid: "1351222720",
        columnsSearch: ["#", "ÁREA", "TEMA", "ENFOQUE"],
        columnsWide: ["#", "ÁREA", "TEMA", "ENFOQUE"],
        columnsSmall: ["#", "ENFOQUE"],
    },
    "Referências Bibliográficas": {
        gid: "180889834",
        columnsSearch: ["TEMA", "TITULO", "LOCAL", "IDEIA"],
        columnsWide: ["TEMA", "TITULO", "LOCAL", "IDEIA"],
        columnsSmall: ["TITULO", "LOCAL", "IDEIA"],
    }
};

// Variáveis de estado da aplicação
let allSheetData = {};
let activeTab = Object.keys(sheetConfigs)[0];


// Função de inicialização
async function init() {
    try {
        // Carregar metadados
        await getMetadata();
        createTabs();
        Object.keys(sheetConfigs).forEach(tabName => {
            initializeFilters(tabName);
        });
        // Define a primeira aba como ativa, o que vai disparar o carregamento dos seus dados
        await setActiveTab(activeTab, true);
    } catch (error) {
        console.error('Erro ao inicializar a aplicação:', error);
        alert('Erro ao iniciar o aplicativo. Por favor, tente novamente mais tarde.');
    } 
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.add('hidden');
    }
}


// Função para obter metadados da planilha
async function getMetadata() {
    try {
        const response = await fetch(`${sheetURL}&gid=${metadataGid}`);
        const csv = await response.text();
        const lines = csv.trim().split('\n');

        const metadata = {};
        if (lines.length > 0) {
            for (const line of lines) {
                const [key, value] = line.split(',').map(cell => cell.trim());
                if (key && value !== undefined) {
                    metadata[key] = value;
                }
            }
        }
        // Adicionar o HTML da última atualização se disponível
        const lastUpdateDate = metadata['last_update'];
        const instructionsContainer = document.querySelector('.instructions .container');
        instructionsContainer.insertAdjacentHTML('beforeend', `<p><b>Última atualização:</b> ${lastUpdateDate}</p>`);
        return metadata;
    } catch (error) {
        console.error('Erro ao carregar metadados:', error);
        return {};
    }
}


// Carrega os dados para uma aba específica, se ainda não foram carregados
async function loadSheetData(sheetName) {
    // Se os dados já existem, não faz nada
    if (allSheetData[sheetName]) {
        return;
    }

    try {
        const abaURL = sheetURL + `&gid=${sheetConfigs[sheetName].gid}`;
        const response = await fetch(abaURL);
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados da aba ${sheetName}: ${response.statusText}`);
        }
        const csvText = await response.text();

        // Usar PapaParse para converter o CSV em um array de objetos
        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true
        });

        // Adicionar coluna de busca concatenada
        const dataWithSearchColumn = result.data.map(row => {
            const config = sheetConfigs[sheetName];
            const searchContent = config.columnsSearch.map(col => row[col] || '').join('|');
            return { ...row, _search: normalizeText(searchContent) };
        });

        // Ordenar os dados pela coluna '#' em ordem decrescente
        const sortedData = dataWithSearchColumn.sort((a, b) => {
            const valA = parseInt(a['#'], 10) || 0;
            const valB = parseInt(b['#'], 10) || 0;
            return valB - valA; // Ordem decrescente
        });


        allSheetData[sheetName] = sortedData;

    } catch (error) {
        console.error(`Erro ao carregar dados da aba ${sheetName}:`, error);
        allSheetData[sheetName] = []; // Define como array vazio em caso de erro para não tentar carregar de novo
    }
}

// Criar as abas na interface
function createTabs() {
    const tabsContainer = document.getElementById('tabs');
    const tabContentContainer = document.getElementById('tab-content');
    
    // Limpar conteúdo existente
    tabsContainer.innerHTML = '';
    tabContentContainer.innerHTML = '';
    
    // Para cada aba configurada
    Object.keys(sheetConfigs).forEach(sheetName => {
        // Criar elemento da aba
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.textContent = sheetName;
        tabElement.dataset.sheetName = sheetName; // Usado para identificar a aba
        tabElement.addEventListener('click', () => setActiveTab(sheetName)); // Adiciona evento de clique
        tabsContainer.appendChild(tabElement);
        
        // Criar container de conteúdo da aba
        const tabContentElement = document.createElement('div');
        tabContentElement.className = 'tab-pane';
        tabContentElement.id = `tab-${sheetName.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Adicionar seção de filtros
        const filtersElement = document.createElement('div');
        filtersElement.className = 'filters';
        filtersElement.id = `filters-${sheetName.toLowerCase().replace(/\s+/g, '-')}`;
        tabContentElement.appendChild(filtersElement);
        
        // Adicionar container da tabela
        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading hidden'; // Começa escondido
        loadingElement.innerHTML = `<span class="spinner"></span><br>Carregando dados...`;
        tabContentElement.appendChild(loadingElement);
        const tableContainer = document.createElement('div');
        tableContainer.className = 'data-container';
        tableContainer.innerHTML = `<table class="data-table" id="table-${sheetName.toLowerCase().replace(/\s+/g, '-')}">
            <thead><tr></tr></thead>
            <tbody></tbody>
        </table>`;
        tabContentElement.appendChild(tableContainer);
        
        // Adicionar ao container principal
        tabContentContainer.appendChild(tabContentElement);
    });
}

// Definir a aba ativa
async function setActiveTab(tabName, firstTime = false) {
    if (activeTab === tabName && !firstTime) return; // Não faz nada se a aba já está ativa

    activeTab = tabName;
    const tabPaneId = `tab-${tabName.toLowerCase().replace(/\s+/g, '-')}`;
    const tabPane = document.getElementById(tabPaneId);
    const loadingElement = tabPane.querySelector('.loading');
    const tableContainer = tabPane.querySelector('.data-container');

    // Atualiza a classe 'active' para as abas e painéis
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.sheetName === tabName);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === tabPaneId);
    });

    // Mostra o spinner e esconde a tabela enquanto carrega
    loadingElement.classList.remove('hidden');
    tableContainer.classList.add('hidden');

    // Carrega os dados (só vai baixar se for a primeira vez)
    await loadSheetData(tabName);

    // Esconde o spinner e mostra a tabela após o carregamento
    loadingElement.classList.add('hidden');
    tableContainer.classList.remove('hidden');

    // Renderiza a tabela com os dados carregados
    renderTable(tabName);
}

// Inicializar os filtros para uma aba específica
function initializeFilters(tabName) {
    const filterContainer = document.getElementById(`filters-${tabName.toLowerCase().replace(/\s+/g, '-')}`);
    const config = sheetConfigs[tabName];
    const data = allSheetData[tabName] || [];
    
    filterContainer.innerHTML = '';
    
    // Criar campo de busca único
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'search-wrapper';
    
    searchWrapper.innerHTML = `
        <div class="search-input-container">
            <label for="search-${tabName.toLowerCase().replace(/\s+/g, '-')}">Busca:</label>
            <input type="text" class="text-filter" id="search-${tabName.toLowerCase().replace(/\s+/g, '-')}" 
                placeholder="Pesquisar..." 
                data-column="_search">
        </div>
    `;
    
    filterContainer.appendChild(searchWrapper);
    
    // Adicionar event listener para o campo de busca
    const searchInput = document.querySelector(`#search-${tabName.toLowerCase().replace(/\s+/g, '-')}`);
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterAndRender(tabName, e.target.value.trim().toLowerCase());
        });
    } else {
        console.error('Campo de busca não encontrado para a aba:', tabName);
    }
}

// Renderizar tabela de dados para uma aba específica
function filterAndRender(tabName, searchValue = '') {
    const tableElement = document.getElementById(`table-${tabName.toLowerCase().replace(/\s+/g, '-')}`);    
    const config = sheetConfigs[tabName];
    const data = allSheetData[tabName] || [];
    const columns = getColumnsForScreenSize(config);

    if (!tableElement) {
        console.error(`Elemento da tabela para ${tabName} não encontrado.`);
        return;
    }
    
    // Limpar tabela existente
    tableElement.innerHTML = '<thead></thead><tbody></tbody>';
    const thead = tableElement.querySelector('thead');
    const tbody = tableElement.querySelector('tbody');
    
    // Criar cabeçalho
    const headerRow = document.createElement('tr');
    columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    
    // Aplicar filtro de busca
    let filteredData;
    if (!searchValue) {
        filteredData = data;
    } else {
        const normalizedSearchValue = normalizeText(searchValue);
        filteredData = data.filter(row =>
            row._search?.includes(normalizedSearchValue)
        );
    }

    // Verificar se há dados
    if (filteredData.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = columns.length > 0 ? columns.length : 1;
        cell.textContent = 'Nenhum registro encontrado';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    } else {
        filteredData.forEach(row => {
            const tr = document.createElement('tr');
            const url = row['URL'] && row['URL'].trim() !== '' ? row['URL'] : null;

            columns.forEach(column => {
                const td = document.createElement('td');
                const cellContent = row[column] || '';

                if (url) {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.textContent = cellContent;
                    td.appendChild(link);
                } else {
                    const span = document.createElement('span')
                    span.textContent = cellContent;
                    td.appendChild(span);
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
}

function renderTable(tabName) {
    const searchValue = document.querySelector(`#search-${tabName.toLowerCase().replace(/\s+/g, '-')}`)?.value || '';
    filterAndRender(tabName, searchValue);
}

// Função auxiliar para obter as colunas baseadas no tamanho da tela
function getColumnsForScreenSize(config) {
    return window.innerWidth >= 900 ? config.columnsWide : config.columnsSmall;
}

// Função auxiliar para normalizar texto (remover acentos e converter para minúsculas)
function normalizeText(text) {
    if (!text) return '';
    return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Função Debounce para otimizar eventos repetitivos como o resize
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}


// Flag para garantir que a inicialização ocorra apenas uma vez
let isInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) return;
    isInitialized = true;   

    init();

    // Adicionar listener para redimensionamento da janela uma única vez
    window.addEventListener('resize', debounce(() => {
        // Renderiza apenas a aba ativa para otimizar a performance
        if (activeTab) renderTable(activeTab);
    }, 250)); // Atraso de 250ms para evitar execuções excessivas
});
