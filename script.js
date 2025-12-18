// --- ELEMENTY INTERFEJSU ---
const textInput = document.getElementById('text-input');
const speakButton = document.getElementById('speak-button');
const mouth = document.getElementById('mouth');
const topicInput = document.getElementById('topic-input');
const autoButton = document.getElementById('auto-button');
const stopButton = document.getElementById('stop-button');
const statusInfo = document.getElementById('status-info');
const langSelect = document.getElementById('language-select');
const genderSelect = document.getElementById('gender-select'); // NOWE
const progressBar = document.getElementById('progress-bar');

// --- ZMIENNE GLOBALNE ---
let currentVoice = null;
let autoInterval = null;
let sentences = [];
let currentSentenceIndex = 0;
const synth = window.speechSynthesis;

// --- LOGIKA WYBORU GŁOSU ---
function loadVoices() {
    const voices = synth.getVoices();
    const lang = langSelect.value;
    const gender = genderSelect.value;

    // Słowa kluczowe dla filtrów
    const maleNames = ['Marek', 'Krzysztof', 'Paul', 'Guy', 'Andrew', 'James', 'Christopher', 'David'];
    const femaleNames = ['Zofia', 'Maja', 'Agnieszka', 'Ewa', 'Jenny', 'Aria', 'Sonia', 'Emma', 'Ava'];

    // Filtrujemy głosy dla wybranego języka
    let filteredVoices = voices.filter(v => v.lang.includes(lang));

    // Próbujemy dopasować płeć na podstawie imion lub metadanych
    let selectedVoice = filteredVoices.find(v => {
        const name = v.name;
        if (gender === 'male') {
            return maleNames.some(m => name.includes(m)) || (name.includes('Natural') && !femaleNames.some(f => name.includes(f)));
        } else {
            return femaleNames.some(f => name.includes(f)) || (name.includes('Natural') && !maleNames.some(m => name.includes(m)));
        }
    });

    // Jeśli nie znaleziono idealnego dopasowania, bierzemy pierwszy lepszy dla danego języka
    currentVoice = selectedVoice || filteredVoices[0];
    
    console.log(`Wybrano głos: ${currentVoice ? currentVoice.name : 'Brak'}`);
}

// Reagowanie na zmiany ustawień
synth.onvoiceschanged = loadVoices;
langSelect.addEventListener('change', loadVoices);
genderSelect.addEventListener('change', loadVoices);
loadVoices();

// --- FUNKCJA AKTUALIZACJI PASKA ---
function updateProgressBar() {
    if (sentences.length === 0) return;
    const progress = ((currentSentenceIndex) / sentences.length) * 100;
    progressBar.style.width = `${progress}%`;
}

// --- GŁÓWNA FUNKCJA MÓWIENIA ---
function speakText(text, callback = null) {
    synth.cancel(); 

    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    if (currentVoice) utterance.voice = currentVoice;
    utterance.lang = langSelect.value === 'pl' ? 'pl-PL' : 'en-US';
    utterance.rate = 1.0; 

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

// --- POBIERANIE DANYCH Z WIKIPEDII ---
async function fetchLongWikiData() {
    const topic = topicInput.value.trim();
    const lang = langSelect.value;
    
    if (!topic) return alert(lang === 'pl' ? "Wpisz temat!" : "Enter a topic!");

    statusInfo.textContent = lang === 'pl' ? "🔍 Szukam..." : "🔍 Searching...";
    progressBar.style.width = "0%";
    
    try {
        const wikiApiUrl = `https://${lang}.wikipedia.org/w/api.php`;
        const searchRes = await fetch(`${wikiApiUrl}?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`);
        const searchData = await searchRes.json();

        if (!searchData.query.search.length) {
            statusInfo.textContent = "❌ Not found.";
            return;
        }

        const bestTitle = searchData.query.search[0].title;
        statusInfo.textContent = `📖 ${bestTitle}`;

        const contentRes = await fetch(`${wikiApiUrl}?action=query&prop=extracts&explaintext=true&titles=${encodeURIComponent(bestTitle)}&format=json&origin=*`);
        const contentData = await contentRes.json();
        
        const pages = contentData.query.pages;
        const pageId = Object.keys(pages)[0];
        const fullText = pages[pageId].extract;

        const cleanText = fullText
            .replace(/\[\d+\]/g, '') 
            .replace(/={2,}/g, '') 
            .replace(/\n+/g, ' ')
            .trim();

        // Dzielenie na zdania (PL i EN)
        sentences = cleanText.match(/[A-ZŚĆŹŻŁÓ].+?([.!?]|\.\.\.)(?=\s[A-ZŚĆŹŻŁÓ]|$)/g) || cleanText.split(/[.!?]+\s/);
        currentSentenceIndex = 0;

        if (sentences.length > 0) {
            startAutoLoop();
        }

    } catch (error) {
        statusInfo.textContent = "❌ Error.";
    }
}

function startAutoLoop() {
    autoButton.style.display = 'none';
    stopButton.style.display = 'inline-block';
    runStep();
}

function runStep() {
    if (currentSentenceIndex < sentences.length) {
        const textToSay = sentences[currentSentenceIndex].trim();
        textInput.value = textToSay; 
        
        updateProgressBar();
        statusInfo.textContent = `🗣️ ${currentSentenceIndex + 1} / ${sentences.length}`;
        
        speakText(textToSay, () => {
            currentSentenceIndex++;
            if (currentSentenceIndex < sentences.length) {
                autoInterval = setTimeout(runStep, 1500); 
            } else {
                updateProgressBar();
                stopAutoMode("Done / Koniec.");
            }
        });
    }
}

function stopAutoMode(msg = "Stopped.") {
    clearTimeout(autoInterval);
    synth.cancel();
    mouth.style.animationPlayState = 'paused';
    autoButton.style.display = 'inline-block';
    stopButton.style.display = 'none';
    statusInfo.textContent = msg;
}

// --- EVENT LISTENERY ---
speakButton.addEventListener('click', () => speakText(textInput.value));
autoButton.addEventListener('click', fetchLongWikiData);
stopButton.addEventListener('click', () => stopAutoMode());