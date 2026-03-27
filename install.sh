#!/bin/bash
# SparkCell Installer
# Installiert SparkCell auf dem Mac mini

set -e

echo "🚀 SparkCell Installer"
echo "======================"
echo ""

# Prüfen ob Node.js installiert ist
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nicht gefunden!"
    echo "Bitte installiere Node.js 18+:"
    echo "  brew install node"
    exit 1
fi

# Prüfen ob git installiert ist
if ! command -v git &> /dev/null; then
    echo "❌ Git nicht gefunden!"
    echo "Bitte installiere Git:"
    echo "  brew install git"
    exit 1
fi

# Verzeichnis definieren
SPARKCELL_DIR="${HOME}/Desktop/sparkcell"

echo "✅ Node.js: $(node --version)"
echo "✅ Git: $(git --version)"
echo ""
echo "Installiere in: ${SPARKCELL_DIR}"
echo ""

# Verzeichnis erstellen
mkdir -p "${SPARKCELL_DIR}"
cd "${SPARKCELL_DIR}"

# Repository clonen (wenn noch nicht da)
if [ ! -d ".git" ]; then
    echo "📥 Cloning SparkCell repository..."
    git clone https://github.com/braunjosua07-ui/sparkcell.git .
else
    echo "🔄 Updating SparkCell..."
    git pull origin main
fi

# Node Modules installieren
echo ""
echo "📦 Installing dependencies..."
npm install

# .env Datei erstellen (mit Platzhalter)
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Tavily API Key (optional - für Web Search)
# TAVILY_API_KEY=dein_key_hier

# OpenRouter API Key (optional - für Cloud LLMs)
# OPENROUTER_API_KEY=dein_key_hier

# OpenAI API Key (optional)
# OPENAI_API_KEY=dein_key_hier
EOF
    echo "✅ .env created - füge deine API Keys hinzu"
fi

echo ""
echo "======================"
echo "✅ SparkCell installiert!"
echo ""
echo "Nächste Schritte:"
echo "1. cd ${SPARKCELL_DIR}"
echo "2. node sparkcell.js --interactive"
echo ""
echo "API Keys kannst du in .env hinzufügen"
echo "Website: https://sparkcell.ai"
