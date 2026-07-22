document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
});

function loadSettings() {
    fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => {
            document.getElementById('showCircleHints').checked = data.show_circle_hints ?? data.show_hints;
            document.getElementById('showDataHints').checked = data.show_data_hints ?? data.show_hints;
            document.getElementById('showTimer').checked = data.show_timer ?? false;
            window.dispatchEvent(new CustomEvent('settings-updated', { detail: data }));
        })
        .catch((err) => console.error('Ошибка загрузки настроек:', err));
}

function saveSettings() {
    const payload = {
        show_circle_hints: document.getElementById('showCircleHints').checked,
        show_data_hints: document.getElementById('showDataHints').checked,
        show_timer: document.getElementById('showTimer').checked,
    };

    fetch('/api/settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })
        .then((res) => res.json())
        .then((data) => {
            const message = document.getElementById('statusMessage');
            message.textContent = 'Настройки сохранены.';
            message.style.color = '#22c55e';
            window.dispatchEvent(new CustomEvent('settings-updated', { detail: data }));
        })
        .catch((err) => {
            const message = document.getElementById('statusMessage');
            message.textContent = 'Ошибка при сохранении.';
            message.style.color = '#f87171';
            console.error('Ошибка сохранения настроек:', err);
        });
}
