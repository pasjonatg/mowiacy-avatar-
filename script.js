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
    // Szukamy głosów "Natural" lub polskich imion
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
    // Zawsze przerywamy obecną mowę przed nową
    synth.cancel(); 

    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    if (maleVoice) utterance.voice = maleVoice;
    utterance.lang = 'pl-PL';
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

    utterance.onerror = () => {
        mouth.style.animationPlayState = 'paused';
        speakButton.disabled = false;
    };

    synth.speak(utterance);
}

// --- POBIERANIE DANYCH Z WIKIPEDII ---
async function fetchLongWikiData() {
    const topic = topicInput.value.trim();
    if (!topic) return alert("Wpisz temat!");

    statusInfo.textContent = "🔍 Szukam tematu...";
    
    try {
        // KROK 1: Wyszukiwanie poprawnego tytułu
        const searchRes = await fetch(`https://pl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`);
        const searchData = await searchRes.json();

        if (!searchData.query.search.length) {
            statusInfo.textContent = "❌ Nie znaleziono artykułu.";
            return;
        }

        const bestTitle = searchData.query.search[0].title;
        statusInfo.textContent = `📖 Pobieram: ${bestTitle}...`;

        // KROK 2: Pobieranie tekstu
        const contentRes = await fetch(`https://pl.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=true&titles=${encodeURIComponent(bestTitle)}&format=json&origin=*`);
        const contentData = await contentRes.json();
        
        const pages = contentData.query.pages;
        const pageId = Object.keys(pages)[0];
        const fullText = pages[pageId].extract;

        if (!fullText) {
            statusInfo.textContent = "❌ Artykuł jest pusty.";
            return;
        }

        // KROK 3: Zaawansowane czyszczenie tekstu
        const cleanText = fullText
            .replace(/\[\d+\]/g, '')         // Usuwa przypisy typu [1], [22]
            .replace(/\(([^)]+)\)/g, '')    // Opcjonalnie: usuwa teksty w nawiasach (często daty/wymowę)
            .replace(/={2,}/g, '')          // Usuwa nagłówki sekcji
            .replace(/\n+/g, ' ')           // Usuwa entery
            .trim();

        // KROK 4: Dzielenie na zdania (uwzględnia kropkę po której jest wielka litera)
        sentences = cleanText.match(/[A-ZŚĆŹŻŁÓ].+?([.!?]|\.\.\.)(?=\s[A-ZŚĆŹŻŁÓ]|$)/g) || [];
        
        // Jeśli match zawiedzie, używamy prostszego podziału jako fallback
        if (sentences.length === 0) {
            sentences = cleanText.split(/[.!?]+\s/).filter(s => s.length > 5);
        }

        currentSentenceIndex = 0;

        if (sentences.length > 0) {
            startAutoLoop();
        } else {
            statusInfo.textContent = "❌ Błąd przetwarzania zdań.";
        }

    } catch (error) {
        console.error(error);
        statusInfo.textContent = "❌ Błąd połączenia.";
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
        statusInfo.textContent = `🗣️ Zdanie ${currentSentenceIndex + 1} z ${sentences.length}`;
        
        speakText(textToSay, () => {
            currentSentenceIndex++;
            if (currentSentenceIndex < sentences.length) {
                // Skrócono czas do 2 sekund - 30s to była bardzo długa pauza
                statusInfo.textContent = "⏳ Chwila przerwy...";
                autoInterval = setTimeout(runStep, 2000); 
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