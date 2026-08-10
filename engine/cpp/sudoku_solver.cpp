#include "sudoku_solver.h"

#include <arpa/inet.h>
#include <cerrno>
#include <cstring>
#include <exception>
#include <iostream>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

namespace {

PuzzleType puzzleTypeFromString(const std::string& value) {
    if (value == "sudoku")
        return PuzzleType::Sudoku;
    if (value == "killer")
        return PuzzleType::KillerSudoku;
    throw std::invalid_argument("Mode inconnu. Utilisez : sudoku ou killer.");
}

void validateDifficulty(const std::string& difficulty) {
    if (difficulty != "facile" && difficulty != "moyen" && difficulty != "difficile")
        throw std::invalid_argument("Difficulte inconnue. Utilisez : facile, moyen ou difficile.");
}

std::string generatePuzzleHtml(PuzzleType puzzleType, const std::string& difficulty, std::uint32_t generationSeed) {
    validateDifficulty(difficulty);
    const bool isKiller = puzzleType == PuzzleType::KillerSudoku;
    const std::size_t clueCount = difficulty == "facile" ? 42 : (difficulty == "moyen" ? 32 : 26);
    const std::size_t maxCageSize = difficulty == "facile" ? 3 : (difficulty == "moyen" ? 4 : 5);

    SudokuSolver solver(9, 0, 0, puzzleType);
    solver.generateUniquePuzzle(isKiller ? 0 : clueCount, maxCageSize, 32, generationSeed);

    SolverTrace trace;
    trace.captureInitial(
        solver.grid(),
        isKiller ? "Grille Killer generee" : "Grille Sudoku generee",
        isKiller
            ? "Les cages bleues en pointilles affichent leur somme. Utilisez les fleches gauche et droite pour parcourir la resolution."
            : "Les possibilites sont filtrees par les lignes, colonnes et boites. Utilisez les fleches gauche et droite pour parcourir la resolution."
    );
    if (!solver.grid().solveBySearch(&trace, true, generationSeed))
        throw std::runtime_error("La grille generee n'a pas pu etre resolue.");

    const std::string title = isKiller ? "Resolution d'un Sudoku Killer" : "Resolution d'un Sudoku";
    return HtmlTraceRenderer::renderToString(solver.grid(), trace, title);
}

std::string queryValue(const std::string& target, const std::string& key) {
    const std::size_t queryStart = target.find('?');
    if (queryStart == std::string::npos)
        return "";

    std::istringstream query(target.substr(queryStart + 1));
    std::string parameter;
    while (std::getline(query, parameter, '&')) {
        const std::size_t separator = parameter.find('=');
        if (separator != std::string::npos && parameter.substr(0, separator) == key)
            return parameter.substr(separator + 1);
    }
    return "";
}

void sendAll(int clientSocket, const std::string& response) {
    std::size_t sent = 0;
    while (sent < response.size()) {
        const ssize_t result = send(clientSocket, response.data() + sent, response.size() - sent, 0);
        if (result <= 0)
            return;
        sent += static_cast<std::size_t>(result);
    }
}

void sendHtmlResponse(int clientSocket, int status, const std::string& statusText, const std::string& body) {
    const std::string response = "HTTP/1.1 " + std::to_string(status) + " " + statusText + "\r\n"
        "Content-Type: text/html; charset=utf-8\r\n"
        "Content-Length: " + std::to_string(body.size()) + "\r\n"
        "Cache-Control: no-store\r\n"
        "Connection: close\r\n\r\n" + body;
    sendAll(clientSocket, response);
}

void serveLocally(unsigned short port) {
    const int serverSocket = socket(AF_INET, SOCK_STREAM, 0);
    if (serverSocket < 0)
        throw std::runtime_error("Impossible de creer le serveur local.");

    const int reuseAddress = 1;
    setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &reuseAddress, sizeof(reuseAddress));

    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = htons(port);
    if (bind(serverSocket, reinterpret_cast<const sockaddr*>(&address), sizeof(address)) < 0) {
        close(serverSocket);
        throw std::runtime_error("Impossible d'utiliser ce port local. Choisissez un autre port.");
    }
    if (listen(serverSocket, 8) < 0) {
        close(serverSocket);
        throw std::runtime_error("Impossible d'ecouter les requetes locales.");
    }

    std::cout << "Serveur local demarre : http://127.0.0.1:" << port << "\n";
    std::cout << "Utilisez Ctrl+C pour l'arreter.\n";

    while (true) {
        const int clientSocket = accept(serverSocket, nullptr, nullptr);
        if (clientSocket < 0) {
            if (errno == EINTR)
                continue;
            break;
        }

        char buffer[8192];
        const ssize_t bytesRead = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
        if (bytesRead <= 0) {
            close(clientSocket);
            continue;
        }
        buffer[bytesRead] = '\0';
        std::istringstream request(buffer);
        std::string method;
        std::string target;
        std::string protocol;
        request >> method >> target >> protocol;

        try {
            if (method != "GET" || (target != "/" && target.rfind("/generate", 0) != 0)) {
                sendHtmlResponse(clientSocket, 404, "Not Found", "<h1>Page introuvable</h1>");
            } else {
                const std::string mode = queryValue(target, "type");
                const std::string difficulty = queryValue(target, "difficulty");
                const PuzzleType puzzleType = puzzleTypeFromString(mode.empty() ? "killer" : mode);
                const std::string selectedDifficulty = difficulty.empty() ? "moyen" : difficulty;
                sendHtmlResponse(
                    clientSocket,
                    200,
                    "OK",
                    generatePuzzleHtml(puzzleType, selectedDifficulty, std::random_device{}())
                );
            }
        } catch (const std::exception& exception) {
            sendHtmlResponse(clientSocket, 500, "Internal Server Error", "<h1>Erreur de generation</h1><p>" + std::string(exception.what()) + "</p>");
        }
        close(clientSocket);
    }

    close(serverSocket);
}

} // namespace

int main(int argumentCount, char* arguments[]) {
    try {
        if (argumentCount > 1 && std::string(arguments[1]) == "serve") {
            if (argumentCount > 3) {
                std::cerr << "Utilisation : ./sudoku_solver serve [port]\n";
                return 1;
            }
            const unsigned long portValue = argumentCount == 3 ? std::stoul(arguments[2]) : 8080;
            if (portValue == 0 || portValue > 65535)
                throw std::invalid_argument("Le port doit etre compris entre 1 et 65535.");
            serveLocally(static_cast<unsigned short>(portValue));
            return 0;
        }

        PuzzleType puzzleType = PuzzleType::KillerSudoku;
        std::string difficulty = "moyen";
        std::uint32_t generationSeed = std::random_device{}();
        if (argumentCount > 1)
            puzzleType = puzzleTypeFromString(arguments[1]);
        if (argumentCount > 2)
            difficulty = arguments[2];
        if (argumentCount > 3)
            generationSeed = static_cast<std::uint32_t>(std::stoul(arguments[3]));
        if (argumentCount > 4) {
            std::cerr << "Utilisation : ./sudoku_solver [sudoku|killer] [facile|moyen|difficile] [graine]\n";
            return 1;
        }

        const std::string html = generatePuzzleHtml(puzzleType, difficulty, generationSeed);
        const std::string outputPath = puzzleType == PuzzleType::KillerSudoku ? "trace-killer.html" : "trace-sudoku.html";
        std::ofstream output(outputPath);
        if (!output)
            throw std::runtime_error("Impossible d'ecrire la trace HTML.");
        output << html;

        std::cout << "Trace generee : " << outputPath << ".\n";
        std::cout << "La grille possede une solution unique (graine " << generationSeed << ").\n";
        return 0;
    } catch (const std::exception& exception) {
        std::cerr << "Erreur : " << exception.what() << '\n';
        return 1;
    }
}
