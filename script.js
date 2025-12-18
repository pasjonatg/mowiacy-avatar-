// --- ELEMENTY INTERFEJSU ---
const textInput = document.getElementById('text-input');
const speakButton = document.getElementById('speak-button');
const mouth = document.getElementById('mouth');
const topicInput = document.getElementById('topic-input');
const autoButton = document.getElementById('auto-button');
const stopButton = document.getElementById('stop-button');
const statusInfo = document.getElementById('status-info');

// --- ZMIENNE GLOBALNE ---
let maleVoice = null;
let autoInterval = null;
let sentences = [];
let currentSentenceIndex = 0;
const synth = window.speechSynthesis;

// --- LOGIKA GŁOSU ---
function loadVoices() {
    const voices = synth.getVoices();
    // Szukamy najlepszego polskiego głosu (Edge ma świetne głosy "Natural")
    maleVoice = voices.find(v => v.lang.includes('pl') && v.name.includes('Natural')) ||
                voices.find(v => v.lang.includes('pl') && (v.name.includes('Marek') || v.name.includes('Krzysztof'))) ||
                voices.find(v => v.lang.includes('pl'));
}

if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
}
loadVoices();

// --- GŁÓWNA FUNKCJA MÓWIENIA ---
function speakText(text, callback = null) {
    if (synth.speaking) synth.cancel(); // Przerwij poprzednie, jeśli jeszcze mówi

    const utterance = new SpeechSynthesisUtterance(text);
    if (maleVoice) utterance.voice = maleVoice;
    utterance.lang = 'pl-PL';
    utterance.rate = 1.0; // Prędkość mówienia

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

// --- NOWA LOGIKA: POBIERANIE PEŁNEJ TREŚCI ---
async function fetchLongWikiData() {
    const topic = topicInput.value.trim();
    if (!topic) return alert("Wpisz temat!");

    statusInfo.textContent = "🔍 Przeszukuję Wikipedię...";
    
    try {
        // KROK 1: Szukamy najtrafniejszego tytułu (rozwiązuje problem małych liter)
        const searchRes = await fetch(`https://pl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`);
        const searchData = await searchRes.json();

        if (searchData.query.search.length === 0) {
            statusInfo.textContent = "❌ Nie znaleziono takiego tematu.";
            return;
        }

        const bestTitle = searchData.query.search[0].title;
        statusInfo.textContent = `📖 Pobieram pełną treść: ${bestTitle}...`;

        // KROK 2: Pobieramy pełną treść artykułu (plaintext)
        const contentRes = await fetch(`https://pl.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=true&titles=${encodeURIComponent(bestTitle)}&format=json&origin=*`);
        const contentData = await contentRes.json();
        
        const pages = contentData.query.pages;
        const pageId = Object.keys(pages)[0];
        const fullText = pages[pageId].extract;

        if (!fullText) {
            statusInfo.textContent = "❌ Treść artykułu jest pusta.";
            return;
        }

        // KROK 3: Czyszczenie tekstu (usuwamy puste linie, nagłówki sekcji typu === Opis ===)
        const cleanText = fullText
            .replace(/={2,}/g, '') // Usuwa znaki ===
            .replace(/\n+/g, ' '); // Zamienia entery na spacje

        // KROK 4: Dzielenie na zdania
        sentences = cleanText.split(/[.!?]+\s/).filter(s => s.length > 15);
        currentSentenceIndex = 0;

        if (sentences.length > 0) {
            startAutoLoop();
        } else {
            statusInfo.textContent = "❌ Nie udało się podzielić tekstu na zdania.";
        }

    } catch (error) {
        console.error(error);
        statusInfo.textContent = "❌ Błąd połączenia z serwerem.";
    }
}

function startAutoLoop() {
    autoButton.style.display = 'none';
    stopButton.style.display = 'inline-block';
    runStep();
}

function runStep() {
    if (currentSentenceIndex < sentences.length) {
        const textToSay = sentences[currentSentenceIndex];
        textInput.value = textToSay; 
        
        statusInfo.textContent = `🗣️ Zdanie ${currentSentenceIndex + 1} z ${sentences.length}`;
        
        speakText(textToSay, () => {
            currentSentenceIndex++;
            if (currentSentenceIndex < sentences.length) {
                // Możesz zmienić 30000 (30s) na np. 5000 (5s), żeby szybciej sprawdzić działanie
                statusInfo.textContent = "⏳ Następna partia za 30 sekund...";
                autoInterval = setTimeout(runStep, 30000); 
            } else {
                stopAutoMode("Koniec artykułu.");
            }
        });
    }
}

function stopAutoMode(msg = "Zatrzymano.") {
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