const API_BASE_URL = 'https://delivery-system-production.up.railway.app';

let autoFetchEnabled = true;
let fetchInterval;
let previousOrders = [];

function playNewOrderSound() {
    const audio = new Audio('new-orders-sound.mp3');
    audio.play();
}

async function fetchOrdersByDate() {
    if (!autoFetchEnabled) return;
    autoFetchEnabled = false;

    const datePicker = document.getElementById('datePicker');
    const selectedDate = datePicker?.value || new Date().toISOString().split('T')[0];

    try {
        const response = await fetch(`${API_BASE_URL}/clientes?date=${selectedDate}`);
        if (!response.ok) throw new Error('Erro ao buscar pedidos: ' + response.statusText);
        const orders = await response.json();

        checkForNewOrders(orders);
        displayOrders(orders);
    } catch (error) {
        console.error(error);
        alert('Erro ao buscar pedidos. Verifique se a data é válida.');
    } finally {
        autoFetchEnabled = true;
    }
}

function startAutoFetch() {
    fetchInterval = setInterval(fetchOrdersByDate, 5000);
}

function setInitialDate() {
    const datePicker = document.getElementById('datePicker');
    if (!datePicker) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    datePicker.value = `${year}-${month}-${day}`;
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.innerText = message;
    notification.classList.remove('hidden');
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hidden');
    }, 6000);
}

document.addEventListener('DOMContentLoaded', () => {
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Permissão para notificações concedida.");
            } else if (permission === "denied") {
                alert("As notificações estão bloqueadas. Você pode ativá-las nas configurações do navegador.");
            }
        });
    }

    setInitialDate();
    fetchOrdersByDate();
    startAutoFetch();
});

function showSystemNotification(title, message) {
    if (Notification.permission === "granted") {
        const options = {
            body: message,
            icon: '/path/to/notification-icon.png',
            requireInteraction: false
        };
        const notification = new Notification(title, options);
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
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

function displayOrders(orders) {
    const ordersBody = document.getElementById('ordersContainer');
    if (!ordersBody) return;

    ordersBody.innerHTML = '';

    if (!orders.length) {
        ordersBody.innerHTML = '<p class="no-orders-message">Nenhum pedido nesta data.</p>';
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('div');
        row.classList.add('order-products');

        // Tratamento seguro da data_pedido
        let formattedDisplayDate = 'Data inválida';
        if (order.data_pedido) {
            try {
                const [time, date] = order.data_pedido.split(' ');
                const [day, month, year] = date.split('/');
                const formattedDate = `${year}-${month}-${day}T${time}`;
                const dateObject = new Date(formattedDate);
                if (!isNaN(dateObject)) {
                    formattedDisplayDate = `${dateObject.toLocaleDateString('pt-BR')} - ${dateObject.toLocaleTimeString('pt-BR')}`;
                }
            } catch {
                // mantém 'Data inválida'
            }
        }

        const produtos = order.produtos || "Sem produtos";
        const status = order.status || 'pendente';

        let statusClass = '';
        switch (status) {
            case 'pendente': statusClass = 'status-pendente'; break;
            case 'em andamento': statusClass = 'status-em-andamento'; break;
            case 'saiu para entrega': statusClass = 'status-saiu-para-entrega'; break;
            case 'entregue': statusClass = 'status-entregue'; break;
            default: statusClass = '';
        }

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

function getNextStatus(currentStatus) {
    switch (currentStatus) {
        case 'pendente': return 'em andamento';
        case 'em andamento': return 'saiu para entrega';
        case 'saiu para entrega': return 'entregue';
        default: return currentStatus;
    }
}

async function changeStatus(clientId, currentStatus) {
    const newStatus = getNextStatus(currentStatus);
    try {
        const response = await fetch(`${API_BASE_URL}/status/${clientId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('Erro ao mudar status');
        await fetchOrdersByDate();
    } catch (error) {
        console.error(error);
        alert('Erro ao mudar status');
    }
}

async function editOrder(clientId) {
    const newProduct = prompt("Digite o novo produto (ex: pastelFrango):");
    const newQuantity = prompt("Digite a nova quantidade:");

    if (!newProduct || !newQuantity) return;

    const quantityNum = parseInt(newQuantity);
    if (isNaN(quantityNum)) {
        alert("Quantidade inválida!");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/edit/${clientId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ produto_id: newProduct, quantidade: quantityNum })
        });
        if (!response.ok) throw new Error('Erro ao editar pedido');
        await fetchOrdersByDate();
    } catch (error) {
        console.error(error);
        alert('Erro ao editar pedido');
    }
}

async function deleteOrder(clientId) {
    if (!confirm("Tem certeza que deseja excluir este pedido e todos os dados associados?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/delete/${clientId}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro desconhecido');
        }
        await fetchOrdersByDate();
        alert('Cliente e todos os dados relacionados excluídos com sucesso!');
    } catch (error) {
        console.error(error);
        alert('Erro ao excluir cliente: ' + error.message);
    }
}

function returnToTodayOrders() {
    setInitialDate();
    fetchOrdersByDate();
}
