// --- ELEMENTY INTERFEJSU ---
const textInput = document.getElementById('text-input');
const speakButton = document.getElementById('speak-button');
const mouth = document.getElementById('mouth');
const topicInput = document.getElementById('topic-input');
const autoButton = document.getElementById('auto-button');
const stopButton = document.getElementById('stop-button');
const statusInfo = document.getElementById('status-info');
const langSelect = document.getElementById('language-select');
const genderSelect = document.getElementById('gender-select');
const speedRange = document.getElementById('speed-range');
const speedValue = document.getElementById('speed-value');
const progressBar = document.getElementById('progress-bar');

// --- ZMIENNE GLOBALNE ---
let currentVoice = null;
let autoInterval = null;
let sentences = [];
let currentSentenceIndex = 0;
const synth = window.speechSynthesis;

// --- LOGIKA WYBORU GŁOSU (PL i EN + Płeć) ---
function loadVoices() {
    const voices = synth.getVoices();
    const lang = langSelect.value; // 'pl' lub 'en'
    const gender = genderSelect.value; // 'male' lub 'female'

    // Rozszerzone listy imion do wykrywania płci
    const maleNames = ['Marek', 'Krzysztof', 'Paul', 'Guy', 'Andrew', 'James', 'David', 'Christopher', 'Stefan', 'Ryan', 'George', 'Frank'];
    const femaleNames = ['Zofia', 'Maja', 'Agnieszka', 'Ewa', 'Jenny', 'Aria', 'Sonia', 'Emma', 'Ava', 'Zuzanna', 'Catherine', 'Linda'];

    // Filtrowanie głosów dla wybranego języka
    let filtered = voices.filter(v => v.lang.toLowerCase().includes(lang.toLowerCase()));

    // Próba znalezienia głosu pasującego do płci
    let selected = filtered.find(v => {
        const name = v.name.toLowerCase();
        if (gender === 'male') {
            return maleNames.some(m => name.includes(m.toLowerCase())) || 
                   (name.includes('male') && !name.includes('female'));
        } else {
            return femaleNames.some(f => name.includes(f.toLowerCase())) || 
                   name.includes('female');
        }
    });

    // Fallback: jeśli nie znaleziono dopasowania męskiego, weź jakikolwiek, który nie jest na liście żeńskiej
    if (!selected && gender === 'male') {
        selected = filtered.find(v => !femaleNames.some(f => v.name.toLowerCase().includes(f.toLowerCase())));
    }

    currentVoice = selected || filtered[0];
    console.log(`Wybrano: ${currentVoice ? currentVoice.name : 'Brak głosu'}`);
}

// Obsługa ładowania głosów przez przeglądarkę
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
}
loadVoices();

// --- ZMIANA USTAWIEŃ W TRAKCIE ---
langSelect.addEventListener('change', loadVoices);
genderSelect.addEventListener('change', loadVoices);
speedRange.addEventListener('input', () => {
    speedValue.textContent = speedRange.value;
});

// --- FUNKCJA PASKA POSTĘPU ---
function updateProgressBar() {
    if (sentences.length === 0) return;
    const progress = (currentSentenceIndex / sentences.length) * 100;
    progressBar.style.width = `${progress}%`;
}

// --- FUNKCJA MÓWIENIA ---
function speakText(text, callback = null) {
    synth.cancel(); // Przerwij, jeśli już coś mówi
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    if (currentVoice) utterance.voice = currentVoice;
    
    // Ustawienie poprawnego kodu języka dla syntezatora
    utterance.lang = langSelect.value === 'pl' ? 'pl-PL' : 'en-US';
    utterance.rate = parseFloat(speedRange.value);

    utterance.onstart = () => {
        mouth.style.animationPlayState = 'running';
        speakButton.disabled = true;
    };

    utterance.onend = () => {
        mouth.style.animationPlayState = 'paused';
        speakButton.disabled = false;
        if (callback) callback();
    };

    utterance.onerror = () => {
        mouth.style.animationPlayState = 'paused';
        speakButton.disabled = false;
    };

    synth.speak(utterance);
}

// --- POBIERANIE DANYCH Z WIKIPEDII ---
async function fetchLongWikiData() {
    const topic = topicInput.value.trim();
    const lang = langSelect.value;
    
    if (!topic) {
        alert(lang === 'pl' ? "Wpisz temat!" : "Please enter a topic!");
        return;
    }

    statusInfo.textContent = lang === 'pl' ? "🔍 Szukam artykułu..." : "🔍 Searching...";
    progressBar.style.width = "0%";

    try {
        const apiUrl = `https://${lang}.wikipedia.org/w/api.php`;
        
        // 1. Szukanie najlepszego tytułu
        const sRes = await fetch(`${apiUrl}?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`);
        const sData = await sRes.json();

        if (!sData.query.search || sData.query.search.length === 0) {
            statusInfo.textContent = lang === 'pl' ? "❌ Nie znaleziono." : "❌ Not found.";
            return;
        }

        const title = sData.query.search[0].title;
        statusInfo.textContent = `📖 ${title}`;

        // 2. Pobieranie pełnej treści
        const cRes = await fetch(`${apiUrl}?action=query&prop=extracts&explaintext=true&titles=${encodeURIComponent(title)}&format=json&origin=*`);
        const cData = await cRes.json();
        const pageId = Object.keys(cData.query.pages)[0];
        const fullText = cData.query.pages[pageId].extract;

        if (!fullText) {
            statusInfo.textContent = "❌ Brak treści.";
            return;
        }

        // 3. Czyszczenie tekstu (przypisy, nagłówki, entery)
        const cleanText = fullText
            .replace(/\[\d+\]/g, '')     // [1], [2]
            .replace(/={2,}/g, '')      // == Sekcja ==
            .replace(/\n+/g, ' ')       // Nowe linie
            .trim();

        // 4. Podział na zdania
        sentences = cleanText.match(/[A-ZŚĆŹŻŁÓ].+?([.!?]|\.\.\.)(?=\s[A-ZŚĆŹŻŁÓ]|$)/g) || cleanText.split(/[.!?]+\s/);
        
        currentSentenceIndex = 0;
        if (sentences.length > 0) {
            autoButton.style.display = 'none';
            stopButton.style.display = 'inline-block';
            runStep();
        } else {
            statusInfo.textContent = "❌ Błąd podziału tekstu.";
        }

    } catch (error) {
        console.error(error);
        statusInfo.textContent = "❌ Błąd połączenia.";
    }
}

function runStep() {
    if (currentSentenceIndex < sentences.length) {
        const text = sentences[currentSentenceIndex].trim();
        if (text.length < 5) { // Pomijaj bardzo krótkie fragmenty
            currentSentenceIndex++;
            runStep();
            return;
        }

        textInput.value = text;
        updateProgressBar();
        statusInfo.textContent = `🗣️ ${currentSentenceIndex + 1} / ${sentences.length}`;

        speakText(text, () => {
            currentSentenceIndex++;
            // Mała pauza między zdaniami dla naturalności
            autoInterval = setTimeout(runStep, 1200);
        });
    } else {
        stopAutoMode(langSelect.value === 'pl' ? "Zakończono czytanie." : "Finished reading.");
    }
}

function stopAutoMode(msg = "Zatrzymano.") {
    clearTimeout(autoInterval);
    synth.cancel();
    mouth.style.animationPlayState = 'paused';
    autoButton.style.display = 'inline-block';
    stopButton.style.display = 'none';
    statusInfo.textContent = msg;
    speakButton.disabled = false;
}

// --- EVENT LISTENERY ---
speakButton.addEventListener('click', () => speakText(textInput.value));
autoButton.addEventListener('click', fetchLongWikiData);
stopButton.addEventListener('click', () => stopAutoMode());