let autoFetchEnabled = true; 
let fetchInterval;
let previousOrders = [];

const newStatus = 'pendente';

function playNewOrderSound() {
    const audio = new Audio('new-orders-sound.mp3'); // Caminho do arquivo de som
    audio.play();
}

async function fetchOrders() {
    if (!autoFetchEnabled) return; 

    try {
        const response = await fetch('/clientes');
        const data = await response.json();
        displayOrders(data);
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
    }
}

// Iniciar a busca automática de pedidos
function startAutoFetch() {
    fetchInterval = setInterval(fetchOrdersByDate, 5000); // A cada 5 segundos
}

// Definindo a data inicial como valor do datePicker
function setInitialDate() {
    const datePicker = document.getElementById('datePicker');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    datePicker.value = `${year}-${month}-${day}`; 
}


// Função para verificar novos pedidos
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.innerText = message;
    notification.classList.remove('hidden');
    notification.classList.add('show');

    // Remove a notificação após 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hidden');
    }, 6000);  // Exibe a notificação por 3 segundos
}

// Pedir permissão para enviar notificações
document.addEventListener('DOMContentLoaded', () => {
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Permissão para notificações concedida.");
            } else if (permission === "denied") {
                alert("As notificações estão bloqueadas. Você pode ativá-las nas configurações do navegador.");
            } else {
                console.log("O usuário ainda não respondeu ao pedido de permissão.");
            }
        });
    }
});


function showSystemNotification(title, message) {
    if (Notification.permission === "granted") {
        const options = {
            body: message,
            icon: '/path/to/notification-icon.png', 
            requireInteraction: false 
        };
        const notification = new Notification(title, options);
        notification.onclick = function() {
            window.focus(); 
            notification.close(); 
        };
    } else {
        console.log("Notificações não estão permitidas.");
        alert("As notificações estão bloqueadas. Você pode ativá-las nas configurações do navegador.");
    }
}


function checkForNewOrders(currentOrders) {
    if (previousOrders.length === 0) {
        previousOrders = currentOrders;
        return;
    }

    const previousOrderIds = previousOrders.map(order => order.client_id);
    const currentOrderIds = currentOrders.map(order => order.client_id);
    const newOrderExists = currentOrderIds.some(id => !previousOrderIds.includes(id));

    if (newOrderExists) {
        playNewOrderSound();  
        showNotification('Novo pedido chegou!'); 
        showSystemNotification('Administração de Pedidos', 'Você tem um novo pedido!'); 
    }

    previousOrders = currentOrders;  
}



// Função para buscar pedidos por data
async function fetchOrdersByDate() {
    const datePicker = document.getElementById('datePicker');
    let selectedDate = datePicker.value || new Date().toISOString().split('T')[0];

    autoFetchEnabled = false; // Desativa a busca automática durante a requisição

    try {
        const response = await fetch(`/clientes?date=${selectedDate}`);
        if (!response.ok) {
            throw new Error('Erro ao buscar pedidos: ' + response.statusText);
        }
        const orders = await response.json();

        checkForNewOrders(orders);

        displayOrders(orders);
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        alert('Erro ao buscar pedidos. Verifique se a data é válida.');
    } finally {
        autoFetchEnabled = true; // Reativa a busca automática após a requisição
    }
}


// Função para retornar aos pedidos do dia atual
function returnToTodayOrders() {
    setInitialDate();
    fetchOrdersByDate(); 
}

// Função para exibir os pedidos na tela
function displayOrders(orders) {
    const ordersBody = document.getElementById('ordersContainer');
    ordersBody.innerHTML = '';

    if (orders.length === 0) {
        ordersBody.innerHTML = '<p class="no-orders-message">Nenhum pedido nesta esta data.</p>';
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('div');
        row.classList.add('order-products');

        // Corrigindo a manipulação da data
        const [time, date] = order.data_pedido.split(' '); // Divide a data e a hora
        const [day, month, year] = date.split('/'); // Divide a data em dia, mês e ano
        const formattedDate = `${year}-${month}-${day} ${time}`; // Formato: YYYY-MM-DD HH:mm:ss
        const dateObject = new Date(formattedDate); // Cria o objeto Date

        const produtos = order.produtos || "Sem produtos";
        const status = order.status || 'pendente';

        // Formatar a data manualmente com traço entre a data e a hora
        const formattedDisplayDate = `${dateObject.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        })} - ${dateObject.toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        })}`;

        // Definir a classe de status com base no status do pedido
        let statusClass = '';
        switch (status) {
            case 'pendente':
                statusClass = 'status-pendente';
                break;
            case 'em andamento':
                statusClass = 'status-em-andamento';
                break;
            case 'saiu para entrega':
                statusClass = 'status-saiu-para-entrega';
                break;
            case 'entregue':
                statusClass = 'status-entregue';
                break;
            default:
                statusClass = '';
        }

        // Construir o HTML para o pedido
        row.innerHTML = `
            <div class="order-products-header">
                <span id="status-${order.client_id}" class="${statusClass}">${status}</span>
                <p>Pedido: ${order.client_id}</p>
                <span>
                    <div class="order-products-date">Data do Pedido: ${formattedDisplayDate}</div>
                </span>
            </div>
            <div class="order-products-name">${order.nome}</div>
            <div class="order-products-address">${order.endereco}</div>
            <div><p>Produtos:</p> ${produtos}</div>
            <div><p>Quantidade Total:</p> ${order.total_quantidade}</div>
            <div><p>Preço Total R$:</p> ${order.total_preco}</div>
            <div><p>Forma de Pagamento:</p> ${order.forma_pagamento}</div>
            <div><p>Troco R$:</p> ${order.troco || 0}</div>
            <div class="order-products-actions">               
                <button onclick="changeStatus(${order.client_id}, '${order.status}')">Mudar Status</button>
                <button onclick="editOrder(${order.client_id})">Editar</button>
                <button onclick="deleteOrder(${order.client_id})">Excluir</button>
            </div>
        `;
        ordersBody.appendChild(row);
    });
}

// Configurações do DOM
document.addEventListener('DOMContentLoaded', () => {
    setInitialDate(); 
    fetchOrdersByDate(); 
    startAutoFetch(); // Iniciar busca automática ao carregar a página
});

// Funções para mudar status, editar e excluir pedidos...

function getNextStatus(currentStatus) {
    switch (currentStatus) {
        case 'pendente':
            return 'em andamento';
        case 'em andamento':
            return 'saiu para entrega';
        case 'saiu para entrega':
            return 'entregue';
        default:
            return currentStatus; // Retorna o status atual se não houver mudança
    }
}

// Função para mudar o status de um pedido
function changeStatus(clientId, currentStatus) {
    const newStatus = getNextStatus(currentStatus);
    
    fetch(`/status/${clientId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Erro ao mudar status');
        }
        return response.json();
    })
    .then(data => {
        console.log('Status atualizado com sucesso:', data);
        fetchOrdersByDate(); // Recarregar pedidos após a atualização
    })
    .catch(error => {
        console.error('Erro ao mudar status:', error);
    });
}

// Função para editar um pedido existente
async function editOrder(clientId) {
    const newProduct = prompt("Digite o novo produto (ex: pastelFrango):");
    const newQuantity = prompt("Digite a nova quantidade:");
    
    if (newProduct && newQuantity) {
        try {
            const response = await fetch(`/edit/${clientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ produto_id: newProduct, quantidade: parseInt(newQuantity) })
            });
            if (response.ok) {
                fetchOrdersByDate(); // Atualizar pedidos após a edição
            } else {
                console.error('Erro ao editar pedido:', response.statusText);
            }
        } catch (error) {
            console.error('Erro ao editar pedido:', error);
        }
    }
}

// Função para excluir um pedido
async function deleteOrder(clientId) {
    if (confirm("Tem certeza que deseja excluir este pedido e todos os dados associados?")) {
        try {
            const response = await fetch(`/delete/${clientId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchOrdersByDate(); // Atualizar pedidos após a exclusão
                alert('Cliente e todos os dados relacionados excluídos com sucesso!'); // Mensagem de sucesso
            } else {
                const errorData = await response.json();
                console.error('Erro ao excluir cliente:', errorData.message);
                alert('Erro ao excluir cliente: ' + errorData.message);
            }
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
            alert('Erro ao excluir cliente: ' + error.message);
        }
    }
}

// ==================== IMPRESSÃO =======================

qz.security.setCertificatePromise(() => {
    return fetch("/path/to/your/certificate.pem") // hospede esse arquivo no seu projeto
        .then(res => res.text());
});

qz.security.setSignaturePromise(toSign => {
    return fetch("/path/to/sign-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: toSign })
    }).then(res => res.text());
});


// Função para imprimir o pedido
function printWithQZ(order) {
    const conteudo = `
Pedido #${order.client_id}
----------------------------
Nome: ${order.nome}
Endereço: ${order.endereco}
----------------------------
${order.produtos}
----------------------------
Total: R$ ${order.total_preco.toFixed(2)}
Pagamento: ${order.forma_pagamento}
Troco: R$ ${order.troco || 0}
----------------------------
Obrigado!
`;

    const config = qz.configs.create(null); // null usa a impressora padrão
    const data = [{
        type: 'raw',
        format: 'plain',
        data: conteudo
    }];

    qz.print(config, data).catch(console.error);
}


