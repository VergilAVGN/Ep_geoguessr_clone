document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
});

function loadSettings() {
    fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => {
            document.getElementById('mode').value = data.mode;
            document.getElementById('difficulty').value = data.difficulty;
            document.getElementById('showHints').checked = data.show_hints;
            document.getElementById('mapSource').value = data.map_source;
        })
        .catch((err) => console.error('Ошибка загрузки настроек:', err));
}

function saveSettings() {
    const payload = {
        mode: document.getElementById('mode').value,
        difficulty: document.getElementById('difficulty').value,
        show_hints: document.getElementById('showHints').checked,
        map_source: document.getElementById('mapSource').value,
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
        })
        .catch((err) => {
            const message = document.getElementById('statusMessage');
            message.textContent = 'Ошибка при сохранении.';
            message.style.color = '#f87171';
            console.error('Ошибка сохранения настроек:', err);
        });
}
