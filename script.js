document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const videoPlayer = document.getElementById('videoPlayer');
    const fileInput = document.getElementById('fileInput');
    const videoList = document.getElementById('videoList');
    const historyList = document.getElementById('historyList');
    const sortButton = document.getElementById('sortButton');
    const searchInput = document.getElementById('searchInput');
    const editModal = document.getElementById('editModal');
    const editVideoName = document.getElementById('editVideoName');
    const saveEditButton = document.getElementById('saveEditButton');
    const closeModal = document.querySelector('.close');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');

    // Переменные состояния
    let videos = [];          // Массив объектов видео: {file, displayName, originalIndex}
    let history = [];         // История просмотров
    let sortOrder = 'asc';    // Порядок сортировки: 'asc' или 'desc'
    let currentVideoToEdit = null; // Индекс редактируемого видео
    let currentVideo = null;  // Текущее воспроизводимое видео
    let displayedVideos = []; // Список отображаемых видео (для переключения)

    // Функция вычисления расстояния Левенштейна для поиска с опечатками
    function levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    // Функция натуральной сортировки
    function naturalCompare(a, b) {
        const ax = [], bx = [];
        a.replace(/(\d+)|(\D+)/g, (_, $1, $2) => ax.push([$1 || Infinity, $2 || ""]));
        b.replace(/(\d+)|(\D+)/g, (_, $1, $2) => bx.push([$1 || Infinity, $2 || ""]));
        while (ax.length && bx.length) {
            const an = ax.shift();
            const bn = bx.shift();
            const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
            if (nn) return nn;
        }
        return ax.length - bx.length;
    }

    // Функция сортировки видео
    function sortVideos() {
        videos.sort((a, b) => {
            const nameA = a.displayName.toUpperCase();
            const nameB = b.displayName.toUpperCase();
            return sortOrder === 'asc' 
                ? naturalCompare(nameA, nameB) 
                : naturalCompare(nameB, nameA);
        });
    }

    // Функция получения длительности видео
    function getVideoDuration(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };
            video.src = URL.createObjectURL(file);
        });
    }

    // Обработка выбора папки с видео
    fileInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files).filter(file => file.name.endsWith('.mp4'));
        videos = files.map((file, index) => ({
            file: file,
            displayName: file.name,
            originalIndex: index
        }));
        files.forEach(file => {
            console.log(file.name); // Здесь можно добавить логику отображения
        });
        sortVideos();
        displayVideos(videos);
    });

    // Обработка сортировки
    sortButton.addEventListener('click', function() {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        sortButton.textContent = sortOrder === 'asc' ? 'Сортировать по названию (А-Я)' : 'Сортировать по названию (Я-А)';
        sortVideos();
        displayVideos(videos);
    });

    // Обработка поиска
    searchInput.addEventListener('input', function() {
        const query = searchInput.value.toLowerCase();
        if (query === '') {
            displayVideos(videos);
        } else {
            const filteredVideos = videos.filter(videoObj => {
                const name = videoObj.displayName.toLowerCase();
                if (name.includes(query)) return true;
                const distance = levenshtein(query, name);
                return distance <= 2;
            });
            displayVideos(filteredVideos);
        }
    });

    // Отображение списка видео
    async function displayVideos(videoArray) {
        displayedVideos = videoArray;
        videoList.innerHTML = '';
        for (const videoObj of videoArray) {
            const duration = await getVideoDuration(videoObj.file);
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            const durationText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

            const videoItem = document.createElement('div');
            videoItem.className = 'video-item';
            videoItem.innerHTML = `
                <canvas class="video-thumbnail" width="100" height="60"></canvas>
                <span class="video-name">${videoObj.displayName}</span>
                <span class="video-duration">${durationText}</span>
                <button class="edit-button" data-index="${videoObj.originalIndex}">✎</button>
            `;
            videoItem.addEventListener('click', () => playVideo(videoObj));
            videoList.appendChild(videoItem);

            createThumbnail(videoObj.file, videoItem.querySelector('.video-thumbnail'));

            const editButton = videoItem.querySelector('.edit-button');
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(videoObj);
            });
        }
    }

    // Создание миниатюры
    function createThumbnail(videoFile, canvas) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.currentTime = 1;

        video.addEventListener('loadeddata', () => {
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(video.src);
        });
    }

    // Воспроизведение видео
    function playVideo(videoObj) {
        currentVideo = videoObj;
        const videoURL = URL.createObjectURL(videoObj.file);
        videoPlayer.src = videoURL;
        videoPlayer.play();
        addToHistory(videoObj);
    }

    // Переключение на предыдущее видео
    function playPreviousVideo() {
        if (!currentVideo || displayedVideos.length === 0) return;
        const currentIndex = displayedVideos.findIndex(v => v.file.name === currentVideo.file.name);
        if (currentIndex > 0) {
            playVideo(displayedVideos[currentIndex - 1]);
        }
    }

    // Переключение на следующее видео
    function playNextVideo() {
        if (!currentVideo || displayedVideos.length === 0) return;
        const currentIndex = displayedVideos.findIndex(v => v.file.name === currentVideo.file.name);
        if (currentIndex < displayedVideos.length - 1) {
            playVideo(displayedVideos[currentIndex + 1]);
        }
    }

    // Обработчики кнопок переключения
    prevButton.addEventListener('click', playPreviousVideo);
    nextButton.addEventListener('click', playNextVideo);

    // Добавление в историю
    function addToHistory(videoObj) {
        const existingIndex = history.findIndex(v => v.file.name === videoObj.file.name);
        if (existingIndex !== -1) history.splice(existingIndex, 1);
        history.unshift(videoObj);
        if (history.length > 5) history.pop();
        displayHistory();
    }

    // Отображение истории
    function displayHistory() {
        historyList.innerHTML = '';
        history.forEach(videoObj => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <canvas class="history-thumbnail" width="80" height="50"></canvas>
                <span class="history-name">${videoObj.displayName}</span>
            `;
            historyItem.addEventListener('click', () => playVideo(videoObj));
            historyList.appendChild(historyItem);
            createThumbnail(videoObj.file, historyItem.querySelector('.history-thumbnail'));
        });
    }

    // Открытие модального окна
    function openEditModal(videoObj) {
        currentVideoToEdit = videoObj.originalIndex;
        editVideoName.value = videoObj.displayName;
        editModal.style.display = 'flex';
    }

    // Закрытие модального окна
    closeModal.addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    // Сохранение изменений
    saveEditButton.addEventListener('click', () => {
        if (currentVideoToEdit !== null && editVideoName.value.trim() !== '') {
            videos[currentVideoToEdit].displayName = editVideoName.value.trim();
            sortVideos();
            displayVideos(videos);
            editModal.style.display = 'none';
        }
    });

    // Управление с клавиатуры
    document.addEventListener('keydown', function(e) {
        const isVideoFocused = document.activeElement === videoPlayer;

        if (isVideoFocused) {
            e.preventDefault(); // Отключаем стандартное поведение для видео-плеера
        }

        switch (e.key) {
            case 'ArrowLeft': 
                if (e.ctrlKey) playPreviousVideo();
                else videoPlayer.currentTime -= 5; // Перемотка на 5 секунд назад
                break;
            case 'ArrowRight': 
                if (e.ctrlKey) playNextVideo();
                else videoPlayer.currentTime += 5; // Перемотка на 5 секунд вперед
                break;
            case 'ArrowUp': 
                if (videoPlayer.volume <= 0.95) videoPlayer.volume += 0.05; 
                break;
            case 'ArrowDown': 
                if (videoPlayer.volume >= 0.05) videoPlayer.volume -= 0.05; 
                break;
        }
    });
});