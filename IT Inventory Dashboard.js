// ========= 1. CHART SETUP & HELPERS ========== //
// Global default settings for all charts
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
Chart.defaults.plugins.legend.position = 'bottom';
Chart.defaults.plugins.tooltip.boxPadding = 8;

/* Creates a doughnut chart with default theme colors and hover effects. */
function makeThemedPie(id, labels, data) {
    const rootStyles = getComputedStyle(document.documentElement);
    const headerBg = rootStyles.getPropertyValue('--header-bg').trim();
    const gray = rootStyles.getPropertyValue('--gray').trim();

    const ctx = document.getElementById(id).getContext('2d');
    
    const existingChart = Chart.getChart(id);
    if (existingChart) {
        existingChart.destroy();
    }
    
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: [headerBg, gray],
                hoverBackgroundColor: [darkenColor(headerBg, 15), '#bfbfbf'],
                hoverOffset: 30
            }]
        },
        options: {
            cutout: '50%',
            radius: '85%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    align: 'start',
                    onClick: null,
                }
            },
            maintainAspectRatio: false,
            animation: { animateRotate: true, animateScale: true }
        }
    });

    return chart;
}

/* Darkens a given hex color by a specified percentage. */
function darkenColor(hex, percent) {
    hex = hex.replace(/^#/, '');
    const num = parseInt(hex, 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) - amt,
        G = (num >> 8 & 0x00FF) - amt,
        B = (num & 0x0000FF) - amt;
    return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// --- Reusable helpers ---
function confirmAction(message) {
    return confirm(message);
}

const FLASH_DURATION = 1000; 

function flashBoth(historyEl, row, cssClass, duration = 1000) {
    if (!historyEl) return;

    requestAnimationFrame(() => {
        historyEl.classList.add(cssClass);
        if (row) {
            row.querySelectorAll('td').forEach(cell => {
                cell.classList.add(cssClass);
            });
        }

        setTimeout(() => {
            historyEl.classList.remove(cssClass);
            if (row) {
                row.querySelectorAll('td').forEach(cell => {
                    cell.classList.remove(cssClass);
                });
            }
        }, duration);
    });
}

// ======== 2. UI INTERACTION HANDLERS ========= //
function toggleZoom(btn) {
    const overlay = document.getElementById('zoom-overlay');
    if (!overlay) return;

    if (overlay.style.display !== 'flex') {
        const pieRow = btn.closest('.pie-row');
        const clone = pieRow.cloneNode(true);
        const closeBtn = clone.querySelector('.zoom-btn');
        closeBtn.textContent = '✖';
        closeBtn.onclick = () => toggleZoom(closeBtn);

        overlay.innerHTML = '';
        overlay.appendChild(clone);
        overlay.style.display = 'flex';

        const originalCanvas = pieRow.querySelector('canvas');
        const clonedCanvas = clone.querySelector('canvas');
        const originalChart = Chart.getChart(originalCanvas);
        
        if (originalChart) {
            const newChart = new Chart(clonedCanvas.getContext('2d'), originalChart.config);
            newChart.options.plugins.legend.position = 'bottom';
            newChart.options.plugins.legend.align = 'center';
            newChart.options.plugins.legend.onClick = null;
            newChart.update();
        }
    } else {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
    }
}

function filterList(input) {
    const filter = input.value.toLowerCase();
    const listBox = input.closest('.list-box');
    const items = listBox.querySelectorAll('ul li');
    const clearBtn = input.nextElementSibling;

    items.forEach(item => {
        const text = item.textContent || item.innerText;
        item.innerHTML = text; 
        if (filter && text.toLowerCase().includes(filter)) {
            const regex = new RegExp(`(${filter})`, 'i');
            item.innerHTML = text.replace(regex, '<mark>$1</mark>');
            item.style.display = '';
        } else {
            item.style.display = filter ? 'none' : '';
        }
    });
}

function clearSearch(btn) {
    const input = btn.previousElementSibling;
    input.value = '';
    btn.style.display = 'none';
    filterList(input);
}

// ======== STORAGE HELPERS ========= //
function saveTasks() {
    const tasks = [];
    document.querySelectorAll('#taskList tr').forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        const textEl = row.querySelector('.task-text');
        tasks.push({
            text: textEl.dataset.originalText,
            done: checkbox.checked
        });
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function loadTasks() {
    const saved = localStorage.getItem('tasks');
    if (!saved) return;

    const taskList = document.getElementById('taskList');
    JSON.parse(saved).forEach(task => {
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td><input type="checkbox" ${task.done ? "checked" : ""}></td>
            <td><span class="task-text" contenteditable="false" data-original-text="${task.text}">${task.text}</span></td>
            <td><button class="delete-btn">✖</button></td>
        `;
        taskList.appendChild(newRow);
        attachCheckboxListener(newRow.querySelector('input[type="checkbox"]'));
        if (task.done) newRow.classList.add("done");
    });
}

function saveHistory() {
    const entries = [];
    document.querySelectorAll('#historyList li').forEach(li => {
        entries.push(li.innerHTML);
    });
    const limited = entries.slice(0, 20); // keep only last 20
    localStorage.setItem('history', JSON.stringify(limited));
}

function loadHistory() {
    const saved = localStorage.getItem('history');
    if (!saved) return;

    const historyList = document.getElementById('historyList');
    JSON.parse(saved).forEach(html => {
        const li = document.createElement('li');
        li.innerHTML = html;
        historyList.appendChild(li);
    });
}

// ======== LOGGING ========= //
function logAction(action, taskText, row = null) {
    const logConfig = {
        'Added':         { icon: '🟢', flash: 'flash-green' },
        'Deleted':       { icon: '🔴', flash: 'flash-red' },
        'Task changed':  { icon: '🟣', flash: 'flash-green' },
        'Marked as done':{ icon: '🟡', flash: 'flash-yellow' },
        'Unchecked':     { icon: '🔵', flash: 'flash-gray' }
    };

    const config = logConfig[action] || { icon: '', flash: '' };
    const historyList = document.getElementById('historyList');
    const newEntry = document.createElement('li');
    const timestamp = new Date().toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    });

    newEntry.innerHTML =
        `${config.icon} ${action} "${taskText}" — <span style="color:#888; font-size:12px;">(${timestamp})</span>`;

    historyList.prepend(newEntry);
    flashBoth(newEntry, row, config.flash, 1000);

    while (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }

    saveHistory();
}

// ========== 3. TASK LIST FUNCTIONS =========== //
function addTask() {
    const input = document.getElementById('newTaskInput');
    const taskText = input.value.trim();
    if (taskText === '') {
        alert('Please enter a task before clicking "Add".');
        return;
    }

    const taskList = document.getElementById('taskList');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="checkbox"></td>
        <td><span class="task-text" contenteditable="false" data-original-text="${taskText}">${taskText}</span></td>
        <td><button class="delete-btn">✖</button></td>
    `;
    taskList.appendChild(newRow);

    attachCheckboxListener(newRow.querySelector('input[type="checkbox"]'));

    logAction('Added', taskText, newRow);
    saveTasks();

    input.value = '';
    document.querySelector('.clear-btn-task').style.display = 'none';
}

function clearTaskInput() {
    const input = document.getElementById('newTaskInput');
    input.value = '';
    input.focus();
    document.querySelector('.clear-btn-task').style.display = 'none';
}

function saveTaskEdit(element) {
    const taskRow = element.closest('tr');

    if (taskRow.classList.contains('done')) {
        alert("Action cannot be made. The task is already marked as done.");
        return;
    }

    const existingMessageRow = document.querySelector('.edit-message-row');
    if (existingMessageRow) existingMessageRow.remove();

    const messageRow = document.createElement('tr');
    messageRow.className = 'edit-message-row';
    messageRow.innerHTML = `
        <td colspan="3" class="edit-message">
            EDITING: Press <strong>enter</strong> to save changes, or click <strong>anywhere</strong> else to cancel.
        </td>
    `;
    taskRow.after(messageRow);

    const handleKeydown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const newText = element.textContent.trim();
            const originalText = element.dataset.originalText;

            if (newText === '') {
                alert("Task cannot be empty. Reverting to original text.");
                element.textContent = originalText;
            } else if (newText !== originalText) {
                logAction('Task changed', `${originalText}" to "${newText}`, taskRow);
                element.dataset.originalText = newText;
                saveTasks();
            }

            cleanup();
        }
    };

    const handleBlur = () => {
        const newText = element.textContent.trim();
        const originalText = element.dataset.originalText;

        if (newText !== originalText) {
            element.textContent = originalText;
        }
        cleanup();
    };

    function cleanup() {
        messageRow.remove();
        element.contentEditable = false;
        element.removeEventListener('keydown', handleKeydown);
        element.removeEventListener('blur', handleBlur);
    }

    element.contentEditable = true;
    element.focus();
    element.addEventListener('keydown', handleKeydown);
    element.addEventListener('blur', handleBlur);
}

function attachCheckboxListener(checkbox) {
    checkbox.addEventListener('change', function() {
        const row = this.closest('tr');
        const taskText = row.children[1].textContent;
        if (this.checked) {
            row.classList.add('done');
            logAction('Marked as done', taskText, row);
        } else {
            row.classList.remove('done');
            logAction('Unchecked', taskText, row);
        }
        saveTasks();
    });
}

function deleteTask(event) {
    event.preventDefault();
    const row = event.target.closest('tr');
    if (!row) return;

    const taskText = row.children[1].textContent;
    if (confirmAction(`Are you sure you want to delete "${taskText}"?`)) {
        logAction('Deleted', taskText, row);
        setTimeout(() => {
            row.remove();
            saveTasks();
        }, 1000);
    }
}

function addHistoryEntry(message, flashClass = '') {
    const historyList = document.getElementById('historyList');
    const newEntry = document.createElement('li');
    const timestamp = new Date().toLocaleString();

    newEntry.innerHTML =
        `${message} — <span style="color:#888; font-size:12px;">(${timestamp})</span>`;

    historyList.prepend(newEntry);

    if (flashClass) {
        newEntry.classList.add(flashClass);
        setTimeout(() => newEntry.classList.remove(flashClass), FLASH_DURATION);
    }

    while (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }

    saveHistory();
}

// ==== 4. INITIALIZATION & EVENT LISTENERS ==== //
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.list-box').forEach(box => {
        if (box.scrollHeight > box.clientHeight) {
            box.classList.add('scroll-dark');
        }
    });
    
    const chartData = [
        ['sgcDeployed', ['Deployed','Not Deployed'], [900,100]],
        ['sgcStatus', ['Online','Offline'], [850,50]],
        ['defenderInstalled', ['Active','Inactive'], [920,80]],
        ['defenderStatus', ['Updated','Outdated'], [900,20]]
    ];
    
    chartData.forEach(args => makeThemedPie(...args));

    loadTasks();
    loadHistory();
    
    document.getElementById('newTaskInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTask();
        }
    });
    
    document.getElementById('taskList').addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('delete-btn')) {
            deleteTask(event);
            return;
        }

        if (target.classList.contains('task-text')) {
            const taskRow = target.closest('tr');
            if (taskRow && taskRow.classList.contains('done')) {
                alert("Action cannot be made. The task is already marked as done.");
                return;
            }
            target.focus();
            saveTaskEdit(target);
        }
    });
    
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('list-search')) {
            const clearBtn = e.target.nextElementSibling;
            clearBtn.style.display = e.target.value.trim() ? 'inline-block' : 'none';
        } else if (e.target.id === 'newTaskInput') {
            const inputContainer = e.target.closest('.addTask-form');
            const clearBtn = inputContainer.querySelector('.clear-btn-task');
            clearBtn.style.display = e.target.value.trim() ? 'inline-block' : 'none';
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === "Escape") {
            document.getElementById('zoom-overlay').style.display = 'none';
        }
    });
});
