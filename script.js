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

// --- LOGIKA GŁOSU ---
function loadVoices() {
    const voices = synth.getVoices();
    const lang = langSelect.value;
    const gender = genderSelect.value;

    const maleNames = ['Marek', 'Krzysztof', 'Paul', 'Guy', 'Andrew', 'James'];
    const femaleNames = ['Zofia', 'Maja', 'Agnieszka', 'Ewa', 'Jenny', 'Aria'];

    let filtered = voices.filter(v => v.lang.includes(lang));

    let selected = filtered.find(v => {
        const n = v.name;
        return gender === 'male' ? 
            maleNames.some(m => n.includes(m)) || (n.includes('Natural') && !femaleNames.some(f => n.includes(f))) :
            femaleNames.some(f => n.includes(f)) || (n.includes('Natural') && !maleNames.some(m => n.includes(m)));
    });

    currentVoice = selected || filtered[0];
}

// Zdarzenia aktualizacji
synth.onvoiceschanged = loadVoices;
langSelect.addEventListener('change', loadVoices);
genderSelect.addEventListener('change', loadVoices);
speedRange.addEventListener('input', () => {
    speedValue.textContent = speedRange.value;
});

loadVoices();

// --- FUNKCJE POMOCNICZE ---
function updateProgressBar() {
    if (sentences.length === 0) return;
    const progress = (currentSentenceIndex / sentences.length) * 100;
    progressBar.style.width = `${progress}%`;
}

function speakText(text, callback = null) {
    synth.cancel();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    if (currentVoice) utterance.voice = currentVoice;
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

    synth.speak(utterance);
}

// --- LOGIKA WIKIPEDII ---
async function fetchLongWikiData() {
    const topic = topicInput.value.trim();
    const lang = langSelect.value;
    if (!topic) return alert(lang === 'pl' ? "Wpisz temat!" : "Enter a topic!");

    statusInfo.textContent = lang === 'pl' ? "🔍 Szukam..." : "🔍 Searching...";
    progressBar.style.width = "0%";

    try {
        const url = `https://${lang}.wikipedia.org/w/api.php`;
        const sRes = await fetch(`${url}?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`);
        const sData = await sRes.json();

        if (!sData.query.search.length) {
            statusInfo.textContent = "❌ Brak wyników.";
            return;
        }

        const title = sData.query.search[0].title;
        const cRes = await fetch(`${url}?action=query&prop=extracts&explaintext=true&titles=${encodeURIComponent(title)}&format=json&origin=*`);
        const cData = await cRes.json();
        const fullText = cData.query.pages[Object.keys(cData.query.pages)[0]].extract;

        const cleanText = fullText.replace(/\[\d+\]/g, '').replace(/={2,}/g, '').replace(/\n+/g, ' ').trim();
        sentences = cleanText.match(/[A-ZŚĆŹŻŁÓ].+?([.!?]|\.\.\.)(?=\s[A-ZŚĆŹŻŁÓ]|$)/g) || cleanText.split(/[.!?]+\s/);
        
        currentSentenceIndex = 0;
        if (sentences.length > 0) {
            autoButton.style.display = 'none';
            stopButton.style.display = 'inline-block';
            runStep();
        }
    } catch (e) {
        statusInfo.textContent = "❌ Błąd połączenia.";
    }
}

function runStep() {
    if (currentSentenceIndex < sentences.length) {
        const text = sentences[currentSentenceIndex].trim();
        textInput.value = text;
        updateProgressBar();
        statusInfo.textContent = `🗣️ ${currentSentenceIndex + 1} / ${sentences.length}`;
        
        speakText(text, () => {
            currentSentenceIndex++;
            autoInterval = setTimeout(runStep, 1500);
        });
    } else {
        stopAutoMode("Koniec artykułu.");
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

// --- EVENTY ---
speakButton.addEventListener('click', () => speakText(textInput.value));
autoButton.addEventListener('click', fetchLongWikiData);
stopButton.addEventListener('click', () => stopAutoMode());