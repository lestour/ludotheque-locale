#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <fstream>
#include <numeric>
#include <random>
#include <stdexcept>
#include <string>
#include <sstream>
#include <utility>
#include <vector>

enum class GroupType {
    Row,
    Column,
    Box,
    Sum
};

enum class PuzzleType {
    Sudoku,
    KillerSudoku
};

enum class SolveTechnique {
    Initialization,
    PeerElimination,
    HiddenSingle,
    NakedSubset,
    SumCombination,
    HouseCageRemainder,
    PointingPair,
    ClaimingPair,
    SearchGuess
};

struct CandidateRemoval {
    short row;
    short col;
    unsigned short digit;
};

struct ValueAssignment {
    short row;
    short col;
    unsigned short value;
};

struct SnapshotCell {
    unsigned short value;
    bool isFixed;
    bool isUserEntered;
    std::vector<bool> candidates;
};

struct GridSnapshot {
    unsigned short size;
    unsigned short boxHeight;
    unsigned short boxWidth;
    std::vector<SnapshotCell> cells;
};

struct TraceEvent {
    SolveTechnique technique;
    std::string title;
    std::string detail;
    std::vector<CandidateRemoval> removals;
    std::vector<ValueAssignment> assignments;
    GridSnapshot snapshot;
};

class Grille;

class SolverTrace {
    private:
        GridSnapshot initialSnapshot_;
        bool hasInitialSnapshot_ = false;
        std::string initialTitle_;
        std::string initialDetail_;
        std::vector<TraceEvent> events_;

    public:
        void captureInitial(const Grille& grid, const std::string& title = "Etat initial", const std::string& detail = "");
        void recordEvent(
            SolveTechnique technique,
            const std::string& title,
            const std::string& detail,
            const std::vector<CandidateRemoval>& removals,
            const std::vector<ValueAssignment>& assignments,
            const Grille& grid
        );

        bool hasInitialSnapshot() const {
            return hasInitialSnapshot_;
        }

        const GridSnapshot& initialSnapshot() const {
            return initialSnapshot_;
        }

        const std::string& initialTitle() const {
            return initialTitle_;
        }

        const std::string& initialDetail() const {
            return initialDetail_;
        }

        const std::vector<TraceEvent>& events() const {
            return events_;
        }

        std::size_t eventCount() const {
            return events_.size();
        }

        void truncate(std::size_t eventCount) {
            if (eventCount < events_.size())
                events_.resize(eventCount);
        }
};

class HtmlTraceRenderer {
    public:
        static void writeToFile(const Grille& grid, const SolverTrace& trace, const std::string& path, const std::string& title = "Sudoku trace");
        static void writeToStream(const Grille& grid, const SolverTrace& trace, std::ostream& output, const std::string& title = "Sudoku trace");
        static std::string renderToString(const Grille& grid, const SolverTrace& trace, const std::string& title = "Sudoku trace");
};

class Cell {
    private:
        unsigned short value_;
        bool isFixed_;
        bool isUserEntered_;
        short row_;
        short col_;
        std::vector<bool> candidates_;

        void normalizeSolvedState() {
            if (value_ != 0) {
                for (std::size_t index = 0; index < candidates_.size(); ++index)
                    candidates_[index] = (index + 1 == value_);
                return;
            }

            unsigned short lastCandidate = 0;
            std::size_t count = 0;
            for (std::size_t index = 0; index < candidates_.size(); ++index) {
                if (!candidates_[index])
                    continue;
                lastCandidate = static_cast<unsigned short>(index + 1);
                ++count;
            }

            if (count == 0)
                throw std::logic_error("A cell cannot have zero candidates.");

            if (count == 1) {
                value_ = lastCandidate;
                for (std::size_t index = 0; index < candidates_.size(); ++index)
                    candidates_[index] = (index + 1 == value_);
            }
        }

    public:
        Cell(unsigned short gridSize = 9, short row = 0, short col = 0, unsigned short value = 0)
            : value_(0), isFixed_(false), isUserEntered_(false), row_(row), col_(col), candidates_(gridSize, true) {
            if (value != 0)
                setValue(value, true);
        }

        unsigned short gridSize() const {
            return static_cast<unsigned short>(candidates_.size());
        }

        unsigned short value() const {
            return value_;
        }

        unsigned short getValue() const {
            return value_;
        }

        bool isFixed() const {
            return isFixed_;
        }

        bool getIsFixed() const {
            return isFixed_;
        }

        bool isUserEntered() const {
            return isUserEntered_;
        }

        bool isSolved() const {
            return value_ != 0;
        }

        short row() const {
            return row_;
        }

        short col() const {
            return col_;
        }

        const std::vector<bool>& candidates() const {
            return candidates_;
        }

        const std::vector<bool>& getPossibleValues() const {
            return candidates_;
        }

        bool hasCandidate(unsigned short digit) const {
            if (digit == 0 || digit > gridSize())
                throw std::out_of_range("Candidate digit is outside the grid range.");
            return candidates_[digit - 1];
        }

        bool isPossibleValue(unsigned short digit) const {
            return hasCandidate(digit);
        }

        std::vector<unsigned short> candidateList() const {
            std::vector<unsigned short> result;
            for (unsigned short digit = 1; digit <= gridSize(); ++digit) {
                if (hasCandidate(digit))
                    result.push_back(digit);
            }
            return result;
        }

        std::size_t candidateCount() const {
            std::size_t count = 0;
            for (bool allowed : candidates_)
                if (allowed)
                    ++count;
            return count;
        }

        void setValue(unsigned short digit) {
            setValue(digit, false, false);
        }

        void setValue(unsigned short digit, bool fixed) {
            setValue(digit, fixed, false);
        }

        void setValue(unsigned short digit, bool fixed, bool userEntered) {
            if (digit > gridSize())
                throw std::out_of_range("Cell value is outside the grid range.");
            if (isFixed_ && value_ != 0 && value_ != digit)
                throw std::logic_error("Cannot overwrite a fixed cell.");

            value_ = digit;
            if (digit != 0) {
                for (std::size_t index = 0; index < candidates_.size(); ++index)
                    candidates_[index] = (index + 1 == digit);
            } else {
                std::fill(candidates_.begin(), candidates_.end(), true);
            }

            if (fixed)
                isFixed_ = true;
            isUserEntered_ = digit != 0 && !isFixed_ && userEntered;
        }

        void clearValue() {
            if (isFixed_)
                throw std::logic_error("Cannot clear a fixed cell.");
            value_ = 0;
            isUserEntered_ = false;
            std::fill(candidates_.begin(), candidates_.end(), true);
        }

        void reset() {
            value_ = 0;
            isFixed_ = false;
            isUserEntered_ = false;
            std::fill(candidates_.begin(), candidates_.end(), true);
        }

        void restoreState(unsigned short value, bool fixed, bool userEntered, const std::vector<bool>& candidates) {
            if (value > gridSize() || candidates.size() != candidates_.size())
                throw std::invalid_argument("The restored cell state does not match the grid.");

            value_ = value;
            isFixed_ = fixed;
            isUserEntered_ = userEntered;
            candidates_ = candidates;
        }

        bool setCandidate(unsigned short digit, bool allowed) {
            if (digit == 0 || digit > gridSize())
                throw std::out_of_range("Candidate digit is outside the grid range.");

            if (isSolved())
                return false;

            const bool previous = candidates_[digit - 1];
            if (previous == allowed)
                return false;

            candidates_[digit - 1] = allowed;
            normalizeSolvedState();
            return true;
        }

        bool setPossibleValue(unsigned short digit, bool allowed) {
            return setCandidate(digit, allowed);
        }

        bool removeCandidate(unsigned short digit) {
            return setCandidate(digit, false);
        }

        bool restrictTo(const std::vector<bool>& allowedMask) {
            if (allowedMask.size() != candidates_.size())
                throw std::invalid_argument("Candidate mask size does not match cell size.");

            if (isSolved())
                return false;

            bool changed = false;
            for (std::size_t index = 0; index < candidates_.size(); ++index) {
                if (candidates_[index] && !allowedMask[index]) {
                    candidates_[index] = false;
                    changed = true;
                }
            }

            if (changed)
                normalizeSolvedState();
            return changed;
        }

        bool operator==(const Cell& other) const {
            return value_ == other.value_
                && isFixed_ == other.isFixed_
                && isUserEntered_ == other.isUserEntered_
                && row_ == other.row_
                && col_ == other.col_
                && candidates_ == other.candidates_;
        }

        bool operator!=(const Cell& other) const {
            return !(*this == other);
        }

        bool operator[](unsigned short index) const {
            return hasCandidate(static_cast<unsigned short>(index + 1));
        }
};

class CellGroup {
    protected:
        GroupType type_;
        std::string name_;
        std::vector<Cell*> cells_;

    public:
        CellGroup(GroupType type, std::string name, std::vector<Cell*> cells)
            : type_(type), name_(std::move(name)), cells_(std::move(cells)) {
            if (cells_.empty())
                throw std::invalid_argument("A group must contain at least one cell.");
        }

        virtual ~CellGroup() = default;

        GroupType type() const {
            return type_;
        }

        const std::string& name() const {
            return name_;
        }

        const std::vector<Cell*>& cells() const {
            return cells_;
        }

        std::vector<Cell*> unsolvedCells() const {
            std::vector<Cell*> result;
            for (Cell* cell : cells_) {
                if (!cell->isSolved())
                    result.push_back(cell);
            }
            return result;
        }

        bool contains(const Cell* target) const {
            return std::find(cells_.begin(), cells_.end(), target) != cells_.end();
        }

        bool allShareRow() const {
            const short referenceRow = cells_.front()->row();
            for (const Cell* cell : cells_) {
                if (cell->row() != referenceRow)
                    return false;
            }
            return true;
        }

        bool allShareColumn() const {
            const short referenceColumn = cells_.front()->col();
            for (const Cell* cell : cells_) {
                if (cell->col() != referenceColumn)
                    return false;
            }
            return true;
        }

        short sharedRow() const {
            if (!allShareRow())
                return -1;
            return cells_.front()->row();
        }

        short sharedColumn() const {
            if (!allShareColumn())
                return -1;
            return cells_.front()->col();
        }
};

class HouseGroup : public CellGroup {
    public:
        HouseGroup(GroupType type, std::string name, std::vector<Cell*> cells)
            : CellGroup(type, std::move(name), std::move(cells)) {
        }

        bool removePlacedDigitsFromPeers() {
            bool changed = false;
            for (const Cell* source : cells_) {
                if (!source->isSolved())
                    continue;

                for (Cell* target : cells_) {
                    if (target == source)
                        continue;
                    changed = target->removeCandidate(source->value()) || changed;
                }
            }
            return changed;
        }

        bool assignHiddenSingles() {
            bool changed = false;
            const unsigned short size = cells_.front()->gridSize();

            for (unsigned short digit = 1; digit <= size; ++digit) {
                bool alreadyPlaced = false;
                Cell* singleCandidate = nullptr;

                for (Cell* cell : cells_) {
                    if (cell->isSolved() && cell->value() == digit) {
                        alreadyPlaced = true;
                        break;
                    }

                    if (!cell->isSolved() && cell->hasCandidate(digit)) {
                        if (singleCandidate != nullptr) {
                            singleCandidate = nullptr;
                            break;
                        }
                        singleCandidate = cell;
                    }
                }

                if (!alreadyPlaced && singleCandidate != nullptr) {
                    singleCandidate->setValue(digit);
                    changed = true;
                }
            }

            return changed;
        }

        bool applyNakedSubset(std::size_t subsetSize) {
            std::vector<Cell*> candidates;
            for (Cell* cell : cells_) {
                const std::size_t count = cell->candidateCount();
                if (!cell->isSolved() && count >= 2 && count <= subsetSize)
                    candidates.push_back(cell);
            }

            if (candidates.size() < subsetSize)
                return false;

            bool changed = false;
            std::vector<Cell*> selection;
            const unsigned short size = cells_.front()->gridSize();

            const auto applySubset = [&](const std::vector<Cell*>& chosen) {
                std::vector<bool> unionMask(size, false);
                std::size_t unionCount = 0;

                for (const Cell* cell : chosen) {
                    for (unsigned short digit = 1; digit <= size; ++digit) {
                        if (cell->hasCandidate(digit) && !unionMask[digit - 1]) {
                            unionMask[digit - 1] = true;
                            ++unionCount;
                        }
                    }
                }

                if (unionCount != subsetSize)
                    return;

                for (Cell* other : cells_) {
                    if (std::find(chosen.begin(), chosen.end(), other) != chosen.end() || other->isSolved())
                        continue;

                    for (unsigned short digit = 1; digit <= size; ++digit) {
                        if (unionMask[digit - 1])
                            changed = other->removeCandidate(digit) || changed;
                    }
                }
            };

            const auto backtrack = [&](const auto& self, std::size_t startIndex) -> void {
                if (selection.size() == subsetSize) {
                    applySubset(selection);
                    return;
                }

                const std::size_t required = subsetSize - selection.size();
                for (std::size_t index = startIndex; index + required <= candidates.size(); ++index) {
                    selection.push_back(candidates[index]);
                    self(self, index + 1);
                    selection.pop_back();
                }
            };

            backtrack(backtrack, 0);
            return changed;
        }
};

class RowGroup : public HouseGroup {
    private:
        short index_;

    public:
        RowGroup(short index, std::vector<Cell*> cells)
            : HouseGroup(GroupType::Row, "row", std::move(cells)), index_(index) {
        }

        short index() const {
            return index_;
        }
};

class ColumnGroup : public HouseGroup {
    private:
        short index_;

    public:
        ColumnGroup(short index, std::vector<Cell*> cells)
            : HouseGroup(GroupType::Column, "column", std::move(cells)), index_(index) {
        }

        short index() const {
            return index_;
        }
};

class BoxGroup : public HouseGroup {
    private:
        short boxRow_;
        short boxColumn_;

    public:
        BoxGroup(short boxRow, short boxColumn, std::vector<Cell*> cells)
            : HouseGroup(GroupType::Box, "box", std::move(cells)), boxRow_(boxRow), boxColumn_(boxColumn) {
        }

        short boxRow() const {
            return boxRow_;
        }

        short boxColumn() const {
            return boxColumn_;
        }
};

class SumConstraintSolver {
    private:
        static bool collectValidAssignments(
            const std::vector<Cell*>& cells,
            std::size_t index,
            unsigned short remainingSum,
            bool requireDistinctDigits,
            std::vector<bool>& usedDigits,
            std::vector<std::vector<bool>>& allowedDigits
        ) {
            if (index == cells.size()) {
                return remainingSum == 0;
            }

            Cell* cell = cells[index];
            bool foundSolution = false;
            for (unsigned short digit : cell->candidateList()) {
                if (digit > remainingSum)
                    continue;
                if (requireDistinctDigits && usedDigits[digit - 1])
                    continue;

                usedDigits[digit - 1] = true;
                const bool branchIsValid = collectValidAssignments(
                    cells,
                    index + 1,
                    static_cast<unsigned short>(remainingSum - digit),
                    requireDistinctDigits,
                    usedDigits,
                    allowedDigits
                );
                if (branchIsValid) {
                    allowedDigits[index][digit - 1] = true;
                    foundSolution = true;
                }
                usedDigits[digit - 1] = false;
            }

            return foundSolution;
        }

    public:
        static bool pruneCandidates(const std::vector<Cell*>& cells, unsigned short targetSum, bool requireDistinctDigits = true) {
            if (cells.empty())
                return false;

            const unsigned short size = cells.front()->gridSize();
            unsigned short solvedSum = 0;
            std::vector<Cell*> unresolvedCells;
            std::vector<bool> usedDigits(size, false);

            for (Cell* cell : cells) {
                if (cell->isSolved()) {
                    solvedSum = static_cast<unsigned short>(solvedSum + cell->value());
                    if (requireDistinctDigits) {
                        if (usedDigits[cell->value() - 1])
                            throw std::logic_error("Duplicate solved digit in a distinct sum constraint.");
                        usedDigits[cell->value() - 1] = true;
                    }
                } else {
                    unresolvedCells.push_back(cell);
                }
            }

            if (solvedSum > targetSum)
                throw std::logic_error("Current sum already exceeds the target sum.");

            if (unresolvedCells.empty()) {
                if (solvedSum != targetSum)
                    throw std::logic_error("Solved cells do not match the expected target sum.");
                return false;
            }

            const unsigned short remainingSum = static_cast<unsigned short>(targetSum - solvedSum);
            std::vector<std::vector<bool>> allowedDigits(
                unresolvedCells.size(),
                std::vector<bool>(size, false)
            );
            const bool foundSolution = collectValidAssignments(
                unresolvedCells,
                0,
                remainingSum,
                requireDistinctDigits,
                usedDigits,
                allowedDigits
            );

            if (!foundSolution)
                throw std::logic_error("No valid digit combination matches the target sum.");

            bool changed = false;
            for (std::size_t index = 0; index < unresolvedCells.size(); ++index)
                changed = unresolvedCells[index]->restrictTo(allowedDigits[index]) || changed;
            return changed;
        }

        static bool pruneTwoCells(Cell& first, Cell& second, unsigned short targetSum, bool requireDistinctDigits = true) {
            std::vector<Cell*> cells = { &first, &second };
            return pruneCandidates(cells, targetSum, requireDistinctDigits);
        }
};

class SumGroup : public CellGroup {
    private:
        unsigned short targetSum_;
        bool requireDistinctDigits_;

    public:
        SumGroup(unsigned short targetSum, std::vector<Cell*> cells, std::string name = "sum-group", bool requireDistinctDigits = true)
            : CellGroup(GroupType::Sum, std::move(name), std::move(cells)),
              targetSum_(targetSum),
              requireDistinctDigits_(requireDistinctDigits) {
        }

        unsigned short targetSum() const {
            return targetSum_;
        }

        unsigned short getSum() const {
            return targetSum_;
        }

        bool requireDistinctDigits() const {
            return requireDistinctDigits_;
        }

        unsigned short calculateCurrentSum() const {
            unsigned short current = 0;
            for (const Cell* cell : cells_) {
                if (cell->isSolved())
                    current = static_cast<unsigned short>(current + cell->value());
            }
            return current;
        }

        unsigned short remainingSum() const {
            return static_cast<unsigned short>(targetSum_ - calculateCurrentSum());
        }

        bool pruneCandidatesBySum() {
            return SumConstraintSolver::pruneCandidates(cells_, targetSum_, requireDistinctDigits_);
        }

        bool updatePossibilities2Cells(Cell* first, Cell* second, unsigned short targetSum) const {
            if (first == nullptr || second == nullptr)
                throw std::invalid_argument("The two cells must be valid.");
            return SumConstraintSolver::pruneTwoCells(*first, *second, targetSum, requireDistinctDigits_);
        }
};

class Cage : public SumGroup {
    public:
        Cage(unsigned short targetSum, std::vector<Cell*> cells)
            : SumGroup(targetSum, std::move(cells), "cage", true) {
        }

        bool updateCagePossibilities2Cells(Cell* first, Cell* second) const {
            if (first == nullptr || second == nullptr)
                throw std::invalid_argument("The two cells must be valid.");
            if (!contains(first) || !contains(second))
                throw std::invalid_argument("Both cells must belong to the same cage.");

            unsigned short otherSolvedSum = 0;
            for (const Cell* cell : cells()) {
                if (cell == first || cell == second || !cell->isSolved())
                    continue;
                otherSolvedSum = static_cast<unsigned short>(otherSolvedSum + cell->value());
            }

            return updatePossibilities2Cells(
                first,
                second,
                static_cast<unsigned short>(targetSum() - otherSolvedSum)
            );
        }
};

class Grille {
    private:
        unsigned short size_;
        unsigned short boxHeight_;
        unsigned short boxWidth_;
        std::vector<std::vector<Cell>> cells_;
        std::vector<RowGroup> rows_;
        std::vector<ColumnGroup> columns_;
        std::vector<BoxGroup> boxes_;
        std::vector<Cage> cages_;

        void buildHouseGroups() {
            rows_.clear();
            columns_.clear();
            boxes_.clear();

            rows_.reserve(size_);
            columns_.reserve(size_);
            for (short row = 0; row < static_cast<short>(size_); ++row) {
                std::vector<Cell*> groupCells;
                groupCells.reserve(size_);
                for (short col = 0; col < static_cast<short>(size_); ++col)
                    groupCells.push_back(&cells_[row][col]);
                rows_.emplace_back(row, std::move(groupCells));
            }

            for (short col = 0; col < static_cast<short>(size_); ++col) {
                std::vector<Cell*> groupCells;
                groupCells.reserve(size_);
                for (short row = 0; row < static_cast<short>(size_); ++row)
                    groupCells.push_back(&cells_[row][col]);
                columns_.emplace_back(col, std::move(groupCells));
            }

            const short boxRows = static_cast<short>(size_ / boxHeight_);
            const short boxCols = static_cast<short>(size_ / boxWidth_);
            for (short boxRow = 0; boxRow < boxRows; ++boxRow) {
                for (short boxCol = 0; boxCol < boxCols; ++boxCol) {
                    std::vector<Cell*> groupCells;
                    groupCells.reserve(size_);
                    for (short offsetRow = 0; offsetRow < static_cast<short>(boxHeight_); ++offsetRow) {
                        for (short offsetCol = 0; offsetCol < static_cast<short>(boxWidth_); ++offsetCol) {
                            groupCells.push_back(
                                &cells_[boxRow * boxHeight_ + offsetRow][boxCol * boxWidth_ + offsetCol]
                            );
                        }
                    }
                    boxes_.emplace_back(boxRow, boxCol, std::move(groupCells));
                }
            }
        }

        short boxIndex(short row, short col) const {
            const short boxColumns = static_cast<short>(size_ / boxWidth_);
            return static_cast<short>((row / boxHeight_) * boxColumns + (col / boxWidth_));
        }

        static std::string formatDigits(const std::vector<unsigned short>& digits) {
            std::ostringstream stream;
            for (std::size_t index = 0; index < digits.size(); ++index) {
                if (index != 0)
                    stream << ", ";
                stream << digits[index];
            }
            return stream.str();
        }

        static std::string formatDigitsFromMask(const std::vector<bool>& mask) {
            std::vector<unsigned short> digits;
            for (std::size_t index = 0; index < mask.size(); ++index) {
                if (mask[index])
                    digits.push_back(static_cast<unsigned short>(index + 1));
            }
            return formatDigits(digits);
        }

        static std::string cellLabel(const Cell& current) {
            std::ostringstream stream;
            stream << "r" << current.row() + 1 << "c" << current.col() + 1;
            return stream.str();
        }

        static std::string groupLabel(const HouseGroup& group) {
            switch (group.type()) {
                case GroupType::Row:
                    return "ligne " + std::to_string(group.cells().front()->row() + 1);
                case GroupType::Column:
                    return "colonne " + std::to_string(group.cells().front()->col() + 1);
                case GroupType::Box: {
                    return "boite ancree en " + cellLabel(*group.cells().front());
                }
                default:
                    return group.name();
            }
        }

        bool recordCandidateBatch(
            const std::vector<std::pair<Cell*, unsigned short>>& operations,
            SolveTechnique technique,
            const std::string& title,
            const std::string& detail,
            SolverTrace* trace
        ) {
            std::vector<CandidateRemoval> removals;
            std::vector<ValueAssignment> assignments;
            std::vector<Cell*> touchedCells;
            std::vector<unsigned short> previousValues;

            for (const auto& [cellPointer, digit] : operations) {
                if (cellPointer == nullptr || cellPointer->isSolved() || !cellPointer->hasCandidate(digit))
                    continue;

                auto iterator = std::find(touchedCells.begin(), touchedCells.end(), cellPointer);
                if (iterator == touchedCells.end()) {
                    touchedCells.push_back(cellPointer);
                    previousValues.push_back(cellPointer->value());
                }

                if (cellPointer->removeCandidate(digit)) {
                    removals.push_back({ cellPointer->row(), cellPointer->col(), digit });
                }
            }

            for (std::size_t index = 0; index < touchedCells.size(); ++index) {
                if (previousValues[index] == 0 && touchedCells[index]->isSolved()) {
                    assignments.push_back({
                        touchedCells[index]->row(),
                        touchedCells[index]->col(),
                        touchedCells[index]->value()
                    });
                }
            }

            if ((!removals.empty() || !assignments.empty()) && trace != nullptr)
                trace->recordEvent(technique, title, detail, removals, assignments, *this);

            return !removals.empty() || !assignments.empty();
        }

        bool recordAssignment(
            Cell& current,
            unsigned short value,
            SolveTechnique technique,
            const std::string& title,
            const std::string& detail,
            SolverTrace* trace
        ) {
            if (current.isSolved() && current.value() == value)
                return false;

            current.setValue(value);
            if (trace != nullptr) {
                trace->recordEvent(
                    technique,
                    title,
                    detail,
                    {},
                    { { current.row(), current.col(), value } },
                    *this
                );
            }

            return true;
        }

        bool recordRestrictionResult(
            const std::vector<Cell*>& affectedCells,
            const std::vector<unsigned short>& previousValues,
            const std::vector<std::vector<bool>>& previousCandidates,
            SolveTechnique technique,
            const std::string& title,
            const std::string& detail,
            SolverTrace* trace
        ) {
            std::vector<CandidateRemoval> removals;
            std::vector<ValueAssignment> assignments;

            for (std::size_t index = 0; index < affectedCells.size(); ++index) {
                Cell* cellPointer = affectedCells[index];
                for (std::size_t digitIndex = 0; digitIndex < previousCandidates[index].size(); ++digitIndex) {
                    if (previousCandidates[index][digitIndex] && !cellPointer->candidates()[digitIndex]) {
                        removals.push_back({
                            cellPointer->row(),
                            cellPointer->col(),
                            static_cast<unsigned short>(digitIndex + 1)
                        });
                    }
                }

                if (previousValues[index] == 0 && cellPointer->isSolved()) {
                    assignments.push_back({
                        cellPointer->row(),
                        cellPointer->col(),
                        cellPointer->value()
                    });
                }
            }

            if ((!removals.empty() || !assignments.empty()) && trace != nullptr)
                trace->recordEvent(technique, title, detail, removals, assignments, *this);

            return !removals.empty() || !assignments.empty();
        }

        bool applyHousePeerElimination(HouseGroup& group, SolverTrace* trace) {
            bool changed = false;

            for (const Cell* source : group.cells()) {
                if (!source->isSolved())
                    continue;

                std::vector<std::pair<Cell*, unsigned short>> operations;
                for (Cell* target : group.cells()) {
                    if (target != source && !target->isSolved() && target->hasCandidate(source->value()))
                        operations.push_back({ target, source->value() });
                }

                if (!operations.empty()) {
                    changed = recordCandidateBatch(
                        operations,
                        SolveTechnique::PeerElimination,
                        "Elimination par pair",
                        "Le chiffre " + std::to_string(source->value()) + " est deja valide dans " + groupLabel(group) + ".",
                        trace
                    ) || changed;
                }
            }

            return changed;
        }

        bool applyHouseHiddenSingles(HouseGroup& group, SolverTrace* trace) {
            bool changed = false;

            for (unsigned short digit = 1; digit <= size_; ++digit) {
                bool alreadyPlaced = false;
                Cell* singleCandidate = nullptr;

                for (Cell* current : group.cells()) {
                    if (current->isSolved() && current->value() == digit) {
                        alreadyPlaced = true;
                        break;
                    }

                    if (!current->isSolved() && current->hasCandidate(digit)) {
                        if (singleCandidate != nullptr) {
                            singleCandidate = nullptr;
                            break;
                        }
                        singleCandidate = current;
                    }
                }

                if (!alreadyPlaced && singleCandidate != nullptr) {
                    changed = recordAssignment(
                        *singleCandidate,
                        digit,
                        SolveTechnique::HiddenSingle,
                        "Single cache",
                        "Le chiffre " + std::to_string(digit) + " ne peut aller qu'en " + cellLabel(*singleCandidate)
                            + " dans " + groupLabel(group) + ".",
                        trace
                    ) || changed;
                }
            }

            return changed;
        }

        bool applyHouseNakedSubset(HouseGroup& group, std::size_t subsetSize, SolverTrace* trace) {
            std::vector<Cell*> subsetCandidates;
            for (Cell* current : group.cells()) {
                const std::size_t count = current->candidateCount();
                if (!current->isSolved() && count >= 2 && count <= subsetSize)
                    subsetCandidates.push_back(current);
            }

            if (subsetCandidates.size() < subsetSize)
                return false;

            bool changed = false;
            std::vector<Cell*> selection;

            const auto applySubset = [&](const std::vector<Cell*>& chosen) {
                std::vector<bool> unionMask(size_, false);
                std::size_t unionCount = 0;

                for (const Cell* current : chosen) {
                    for (unsigned short digit = 1; digit <= size_; ++digit) {
                        if (current->hasCandidate(digit) && !unionMask[digit - 1]) {
                            unionMask[digit - 1] = true;
                            ++unionCount;
                        }
                    }
                }

                if (unionCount != subsetSize)
                    return;

                std::vector<std::pair<Cell*, unsigned short>> operations;
                for (Cell* current : group.cells()) {
                    if (current->isSolved() || std::find(chosen.begin(), chosen.end(), current) != chosen.end())
                        continue;
                    for (unsigned short digit = 1; digit <= size_; ++digit) {
                        if (unionMask[digit - 1] && current->hasCandidate(digit))
                            operations.push_back({ current, digit });
                    }
                }

                if (operations.empty())
                    return;

                std::ostringstream detail;
                detail << "Les cases ";
                for (std::size_t index = 0; index < chosen.size(); ++index) {
                    if (index != 0)
                        detail << ", ";
                    detail << cellLabel(*chosen[index]);
                }
                detail << " se partagent uniquement {" << formatDigitsFromMask(unionMask) << "} dans " << groupLabel(group) << ".";

                changed = recordCandidateBatch(
                    operations,
                    SolveTechnique::NakedSubset,
                    "Sous-ensemble nu",
                    detail.str(),
                    trace
                ) || changed;
            };

            const auto backtrack = [&](const auto& self, std::size_t startIndex) -> void {
                if (selection.size() == subsetSize) {
                    applySubset(selection);
                    return;
                }

                const std::size_t required = subsetSize - selection.size();
                for (std::size_t index = startIndex; index + required <= subsetCandidates.size(); ++index) {
                    selection.push_back(subsetCandidates[index]);
                    self(self, index + 1);
                    selection.pop_back();
                }
            };

            backtrack(backtrack, 0);
            return changed;
        }

    public:
        explicit Grille(unsigned short size, unsigned short boxHeight = 0, unsigned short boxWidth = 0)
            : size_(size), boxHeight_(boxHeight), boxWidth_(boxWidth) {
            if (size_ == 0)
                throw std::invalid_argument("The grid size must be strictly positive.");

            if (boxHeight_ == 0 || boxWidth_ == 0) {
                const unsigned short root = static_cast<unsigned short>(std::sqrt(size_));
                if (root * root != size_)
                    throw std::invalid_argument("Provide box dimensions when the grid size is not a perfect square.");
                boxHeight_ = root;
                boxWidth_ = root;
            }

            if (boxHeight_ * boxWidth_ != size_)
                throw std::invalid_argument("The box area must match the grid size.");
            if (size_ % boxHeight_ != 0 || size_ % boxWidth_ != 0)
                throw std::invalid_argument("Box dimensions must tile the full grid.");

            cells_.reserve(size_);
            for (short row = 0; row < static_cast<short>(size_); ++row) {
                std::vector<Cell> line;
                line.reserve(size_);
                for (short col = 0; col < static_cast<short>(size_); ++col)
                    line.emplace_back(size_, row, col);
                cells_.push_back(std::move(line));
            }

            buildHouseGroups();
        }

        unsigned short getSize() const {
            return size_;
        }

        unsigned short boxHeight() const {
            return boxHeight_;
        }

        unsigned short boxWidth() const {
            return boxWidth_;
        }

        Cell& cell(short row, short col) {
            return cells_.at(row).at(col);
        }

        const Cell& cell(short row, short col) const {
            return cells_.at(row).at(col);
        }

        unsigned short getCellValue(short row, short col) const {
            return cell(row, col).value();
        }

        void setCellValue(
            short row,
            short col,
            unsigned short digit,
            bool fixed = false,
            bool updateConstraints = true,
            SolverTrace* trace = nullptr
        ) {
            if (!canPlace(row, col, digit))
                throw std::logic_error("The digit conflicts with an existing row, column, or box value.");

            if (trace != nullptr && !trace->hasInitialSnapshot())
                trace->captureInitial(*this);

            cell(row, col).setValue(digit, fixed, !fixed);

            if (trace != nullptr) {
                trace->recordEvent(
                    SolveTechnique::Initialization,
                    "Valeur saisie",
                    "Le chiffre " + std::to_string(digit) + " est place en r" + std::to_string(row + 1)
                        + "c" + std::to_string(col + 1) + ".",
                    {},
                    { { row, col, digit } },
                    *this
                );
            }

            if (updateConstraints)
                propagateConstraints(trace);
        }

        bool getCellPossibleValue(short row, short col, unsigned short digit) const {
            return cell(row, col).hasCandidate(digit);
        }

        void setCellPossibleValue(short row, short col, unsigned short digit, bool allowed) {
            cell(row, col).setCandidate(digit, allowed);
        }

        void reset() {
            cages_.clear();
            for (auto& row : cells_) {
                for (Cell& current : row)
                    current.reset();
            }
        }

        unsigned short operator()(short row, short col) const {
            return getCellValue(row, col);
        }

        void operator()(short row, short col, unsigned short digit) {
            setCellValue(row, col, digit);
        }

        const std::vector<RowGroup>& rows() const {
            return rows_;
        }

        const std::vector<ColumnGroup>& columns() const {
            return columns_;
        }

        const std::vector<BoxGroup>& boxes() const {
            return boxes_;
        }

        const std::vector<Cage>& cages() const {
            return cages_;
        }

        GridSnapshot snapshot() const {
            GridSnapshot currentSnapshot;
            currentSnapshot.size = size_;
            currentSnapshot.boxHeight = boxHeight_;
            currentSnapshot.boxWidth = boxWidth_;
            currentSnapshot.cells.reserve(size_ * size_);

            for (const auto& row : cells_) {
                for (const Cell& current : row) {
                    currentSnapshot.cells.push_back({
                        current.value(),
                        current.isFixed(),
                        current.isUserEntered(),
                        current.candidates()
                    });
                }
            }

            return currentSnapshot;
        }

        void restoreSnapshot(const GridSnapshot& previousSnapshot) {
            if (previousSnapshot.size != size_
                || previousSnapshot.boxHeight != boxHeight_
                || previousSnapshot.boxWidth != boxWidth_
                || previousSnapshot.cells.size() != static_cast<std::size_t>(size_) * size_) {
                throw std::invalid_argument("The snapshot does not match this grid.");
            }

            for (short row = 0; row < static_cast<short>(size_); ++row) {
                for (short col = 0; col < static_cast<short>(size_); ++col) {
                    const SnapshotCell& previousCell = previousSnapshot.cells[row * size_ + col];
                    cell(row, col).restoreState(
                        previousCell.value,
                        previousCell.isFixed,
                        previousCell.isUserEntered,
                        previousCell.candidates
                    );
                }
            }
        }

        void exportTraceHtml(const SolverTrace& trace, const std::string& path, const std::string& title = "Sudoku trace") const {
            HtmlTraceRenderer::writeToFile(*this, trace, path, title);
        }

        Cage& addCage(unsigned short targetSum, const std::vector<std::pair<short, short>>& positions) {
            std::vector<Cell*> cageCells;
            cageCells.reserve(positions.size());
            for (const auto& [row, col] : positions)
                cageCells.push_back(&cell(row, col));
            cages_.emplace_back(targetSum, std::move(cageCells));
            return cages_.back();
        }

        bool isComplete() const {
            for (const auto& row : cells_) {
                for (const Cell& current : row) {
                    if (!current.isSolved())
                        return false;
                }
            }
            return true;
        }

        bool canPlace(short row, short col, unsigned short digit) const {
            const Cell& target = cell(row, col);
            if (target.isSolved() && target.value() != digit)
                return false;

            for (const Cell* peer : rows_.at(row).cells()) {
                if (peer->col() != col && peer->isSolved() && peer->value() == digit)
                    return false;
            }

            for (const Cell* peer : columns_.at(col).cells()) {
                if (peer->row() != row && peer->isSolved() && peer->value() == digit)
                    return false;
            }

            for (const Cell* peer : boxes_.at(boxIndex(row, col)).cells()) {
                if ((peer->row() != row || peer->col() != col) && peer->isSolved() && peer->value() == digit)
                    return false;
            }

            return true;
        }

        bool isRowValid(short row, short digit) const {
            for (const Cell* current : rows_.at(row).cells()) {
                if (current->isSolved() && current->value() == digit)
                    return false;
            }
            return true;
        }

        bool isColValid(short col, short digit) const {
            for (const Cell* current : columns_.at(col).cells()) {
                if (current->isSolved() && current->value() == digit)
                    return false;
            }
            return true;
        }

        bool isBoxValid(short row, short col, unsigned short digit) const {
            for (const Cell* peer : boxes_.at(boxIndex(row, col)).cells()) {
                if ((peer->row() != row || peer->col() != col) && peer->isSolved() && peer->value() == digit)
                    return false;
            }
            return true;
        }

        bool isValid(short row, short col, unsigned short digit) const {
            return canPlace(row, col, digit);
        }

        bool validate() const {
            const auto validateDistinctGroup = [](const HouseGroup& group) {
                const unsigned short size = group.cells().front()->gridSize();
                std::vector<bool> seen(size, false);
                for (const Cell* current : group.cells()) {
                    if (!current->isSolved())
                        continue;
                    if (seen[current->value() - 1])
                        return false;
                    seen[current->value() - 1] = true;
                }
                return true;
            };

            for (const RowGroup& group : rows_)
                if (!validateDistinctGroup(group))
                    return false;
            for (const ColumnGroup& group : columns_)
                if (!validateDistinctGroup(group))
                    return false;
            for (const BoxGroup& group : boxes_)
                if (!validateDistinctGroup(group))
                    return false;

            for (const Cage& cage : cages_) {
                unsigned short sum = 0;
                std::vector<bool> seen(size_, false);
                for (const Cell* current : cage.cells()) {
                    if (!current->isSolved())
                        continue;
                    sum = static_cast<unsigned short>(sum + current->value());
                    if (seen[current->value() - 1])
                        return false;
                    seen[current->value() - 1] = true;
                }
                if (sum > cage.targetSum())
                    return false;
                if (std::all_of(cage.cells().begin(), cage.cells().end(), [](const Cell* current) { return current->isSolved(); })
                    && sum != cage.targetSum()) {
                    return false;
                }
            }

            return true;
        }

        bool applyHouseRules(SolverTrace* trace = nullptr) {
            bool changed = false;

            const auto processHouse = [&](HouseGroup& group) {
                changed = applyHousePeerElimination(group, trace) || changed;
                changed = applyHouseHiddenSingles(group, trace) || changed;

                for (std::size_t subsetSize = 2; subsetSize <= 4 && subsetSize < group.cells().size(); ++subsetSize)
                    changed = applyHouseNakedSubset(group, subsetSize, trace) || changed;
            };

            for (RowGroup& group : rows_)
                processHouse(group);
            for (ColumnGroup& group : columns_)
                processHouse(group);
            for (BoxGroup& group : boxes_)
                processHouse(group);

            return changed;
        }

        bool applyCageRules(SolverTrace* trace = nullptr) {
            bool changed = false;

            for (Cage& cage : cages_) {
                std::vector<Cell*> affectedCells;
                std::vector<unsigned short> previousValues;
                std::vector<std::vector<bool>> previousCandidates;

                for (Cell* current : cage.cells()) {
                    if (current->isSolved())
                        continue;
                    affectedCells.push_back(current);
                    previousValues.push_back(current->value());
                    previousCandidates.push_back(current->candidates());
                }

                if (affectedCells.empty())
                    continue;

                cage.pruneCandidatesBySum();

                std::ostringstream detail;
                detail << "Dans la cage de somme " << cage.targetSum()
                       << ", seules les combinaisons compatibles avec les candidats restants sont conservees.";

                changed = recordRestrictionResult(
                    affectedCells,
                    previousValues,
                    previousCandidates,
                    SolveTechnique::SumCombination,
                    "Filtrage par somme",
                    detail.str(),
                    trace
                ) || changed;
            }

            return changed;
        }

        bool applyHouseCageRemainderRules(SolverTrace* trace = nullptr) {
            bool changed = false;
            const unsigned short houseSum = static_cast<unsigned short>(size_ * (size_ + 1) / 2);

            const auto processHouse = [&](const HouseGroup& house) {
                unsigned short enclosedCageSum = 0;
                bool hasEnclosedCage = false;
                std::vector<bool> coveredByEnclosedCage(house.cells().size(), false);

                for (const Cage& cage : cages_) {
                    const bool isEnclosed = std::all_of(
                        cage.cells().begin(),
                        cage.cells().end(),
                        [&](const Cell* current) { return house.contains(current); }
                    );
                    if (!isEnclosed)
                        continue;

                    hasEnclosedCage = true;
                    enclosedCageSum = static_cast<unsigned short>(enclosedCageSum + cage.targetSum());
                    for (std::size_t index = 0; index < house.cells().size(); ++index) {
                        if (cage.contains(house.cells()[index]))
                            coveredByEnclosedCage[index] = true;
                    }
                }

                if (!hasEnclosedCage)
                    return;
                if (enclosedCageSum > houseSum)
                    throw std::logic_error("The enclosed cage sums exceed the house total.");

                std::vector<Cell*> remainingCells;
                std::vector<Cell*> affectedCells;
                std::vector<unsigned short> previousValues;
                std::vector<std::vector<bool>> previousCandidates;
                for (std::size_t index = 0; index < house.cells().size(); ++index) {
                    if (coveredByEnclosedCage[index])
                        continue;

                    Cell* current = house.cells()[index];
                    remainingCells.push_back(current);
                    if (!current->isSolved()) {
                        affectedCells.push_back(current);
                        previousValues.push_back(current->value());
                        previousCandidates.push_back(current->candidates());
                    }
                }

                if (remainingCells.empty() || affectedCells.empty())
                    return;

                const unsigned short remainingSum = static_cast<unsigned short>(houseSum - enclosedCageSum);
                SumConstraintSolver::pruneCandidates(remainingCells, remainingSum, true);

                std::ostringstream detail;
                detail << "Dans " << groupLabel(house) << ", la somme totale est " << houseSum
                       << ". Les cages entierement incluses totalisent " << enclosedCageSum
                       << ", donc les cellules restantes doivent totaliser " << remainingSum << ".";

                changed = recordRestrictionResult(
                    affectedCells,
                    previousValues,
                    previousCandidates,
                    SolveTechnique::HouseCageRemainder,
                    "Somme des cages sortantes",
                    detail.str(),
                    trace
                ) || changed;
            };

            for (const RowGroup& row : rows_)
                processHouse(row);
            for (const ColumnGroup& column : columns_)
                processHouse(column);
            for (const BoxGroup& box : boxes_)
                processHouse(box);

            return changed;
        }

        bool applyPointingPairs(SolverTrace* trace = nullptr) {
            bool changed = false;

            for (const BoxGroup& box : boxes_) {
                for (unsigned short digit = 1; digit <= size_; ++digit) {
                    std::vector<Cell*> candidates;
                    bool alreadyPlaced = false;
                    for (Cell* current : box.cells()) {
                        if (current->isSolved() && current->value() == digit) {
                            alreadyPlaced = true;
                            break;
                        }
                        if (!current->isSolved() && current->hasCandidate(digit))
                            candidates.push_back(current);
                    }

                    if (alreadyPlaced || candidates.size() < 2)
                        continue;

                    const short row = candidates.front()->row();
                    const short col = candidates.front()->col();
                    const bool sameRow = std::all_of(
                        candidates.begin(),
                        candidates.end(),
                        [row](const Cell* current) { return current->row() == row; }
                    );
                    const bool sameColumn = std::all_of(
                        candidates.begin(),
                        candidates.end(),
                        [col](const Cell* current) { return current->col() == col; }
                    );

                    if (sameRow) {
                        std::vector<std::pair<Cell*, unsigned short>> operations;
                        for (Cell* current : rows_.at(row).cells()) {
                            if (!box.contains(current))
                                operations.push_back({ current, digit });
                        }
                        if (!operations.empty()) {
                            changed = recordCandidateBatch(
                                operations,
                                SolveTechnique::PointingPair,
                                "Pointing pair",
                                "Dans une boite, le chiffre " + std::to_string(digit)
                                    + " est restreint a la ligne " + std::to_string(row + 1) + ".",
                                trace
                            ) || changed;
                        }
                    }

                    if (sameColumn) {
                        std::vector<std::pair<Cell*, unsigned short>> operations;
                        for (Cell* current : columns_.at(col).cells()) {
                            if (!box.contains(current))
                                operations.push_back({ current, digit });
                        }
                        if (!operations.empty()) {
                            changed = recordCandidateBatch(
                                operations,
                                SolveTechnique::PointingPair,
                                "Pointing pair",
                                "Dans une boite, le chiffre " + std::to_string(digit)
                                    + " est restreint a la colonne " + std::to_string(col + 1) + ".",
                                trace
                            ) || changed;
                        }
                    }
                }
            }

            return changed;
        }

        bool applyClaimingPairs(SolverTrace* trace = nullptr) {
            bool changed = false;

            const auto processLine = [&](const auto& lines, bool checkRows) {
                for (const auto& line : lines) {
                    for (unsigned short digit = 1; digit <= size_; ++digit) {
                        std::vector<Cell*> candidates;
                        bool alreadyPlaced = false;
                        for (Cell* current : line.cells()) {
                            if (current->isSolved() && current->value() == digit) {
                                alreadyPlaced = true;
                                break;
                            }
                            if (!current->isSolved() && current->hasCandidate(digit))
                                candidates.push_back(current);
                        }

                        if (alreadyPlaced || candidates.size() < 2)
                            continue;

                        const short firstBox = boxIndex(candidates.front()->row(), candidates.front()->col());
                        const bool sameBox = std::all_of(
                            candidates.begin(),
                            candidates.end(),
                            [&](const Cell* current) {
                                return boxIndex(current->row(), current->col()) == firstBox;
                            }
                        );

                        if (!sameBox)
                            continue;

                        std::vector<std::pair<Cell*, unsigned short>> operations;
                        for (Cell* current : boxes_.at(firstBox).cells()) {
                            const bool sameLine = checkRows
                                ? current->row() == candidates.front()->row()
                                : current->col() == candidates.front()->col();
                            if (!sameLine)
                                operations.push_back({ current, digit });
                        }

                        if (!operations.empty()) {
                            const std::string lineType = checkRows ? "ligne " : "colonne ";
                            const int lineIndex = checkRows
                                ? candidates.front()->row() + 1
                                : candidates.front()->col() + 1;
                            changed = recordCandidateBatch(
                                operations,
                                SolveTechnique::ClaimingPair,
                                "Claiming pair",
                                "Dans la " + lineType + std::to_string(lineIndex)
                                    + ", le chiffre " + std::to_string(digit)
                                    + " est restreint a une seule boite.",
                                trace
                            ) || changed;
                        }
                    }
                }
            };

            processLine(rows_, true);
            processLine(columns_, false);
            return changed;
        }

        bool propagateConstraints(SolverTrace* trace = nullptr) {
            bool anyChange = false;
            bool changed = false;

            if (trace != nullptr && !trace->hasInitialSnapshot())
                trace->captureInitial(*this);

            do {
                changed = false;
                changed = applyHouseRules(trace) || changed;
                changed = applyCageRules(trace) || changed;
                changed = applyHouseCageRemainderRules(trace) || changed;
                changed = applyPointingPairs(trace) || changed;
                changed = applyClaimingPairs(trace) || changed;
                anyChange = changed || anyChange;
            } while (changed);

            return anyChange;
        }

        std::size_t countSolutions(std::size_t limit = 2) {
            if (limit == 0)
                return 0;

            const GridSnapshot originalSnapshot = snapshot();
            const auto selectCell = [&]() -> Cell* {
                Cell* selected = nullptr;
                for (auto& row : cells_) {
                    for (Cell& current : row) {
                        if (current.isSolved())
                            continue;
                        if (selected == nullptr || current.candidateCount() < selected->candidateCount())
                            selected = &current;
                    }
                }
                return selected;
            };

            const auto search = [&](const auto& self) -> std::size_t {
                if (isComplete())
                    return validate() ? 1 : 0;

                Cell* target = selectCell();
                if (target == nullptr)
                    return 0;

                const GridSnapshot branchSnapshot = snapshot();
                std::size_t solutionCount = 0;
                for (unsigned short digit : target->candidateList()) {
                    restoreSnapshot(branchSnapshot);
                    if (!canPlace(target->row(), target->col(), digit))
                        continue;

                    try {
                        target->setValue(digit);
                        propagateConstraints();
                        if (validate())
                            solutionCount += self(self);
                    } catch (const std::logic_error&) {
                    }

                    if (solutionCount >= limit)
                        break;
                }

                restoreSnapshot(branchSnapshot);
                return std::min(limit, solutionCount);
            };

            try {
                propagateConstraints();
                const std::size_t solutionCount = validate() ? search(search) : 0;
                restoreSnapshot(originalSnapshot);
                return solutionCount;
            } catch (const std::logic_error&) {
                restoreSnapshot(originalSnapshot);
                return 0;
            }
        }

        bool solveBySearch(
            SolverTrace* trace = nullptr,
            bool randomizeCandidates = true,
            std::uint32_t seed = std::random_device{}()
        ) {
            if (trace != nullptr && !trace->hasInitialSnapshot())
                trace->captureInitial(*this);

            const GridSnapshot originalSnapshot = snapshot();
            const std::size_t originalEventCount = trace == nullptr ? 0 : trace->eventCount();
            std::mt19937 engine(seed);

            const auto selectCell = [&]() -> Cell* {
                Cell* selected = nullptr;
                for (auto& row : cells_) {
                    for (Cell& current : row) {
                        if (current.isSolved())
                            continue;
                        if (selected == nullptr || current.candidateCount() < selected->candidateCount())
                            selected = &current;
                    }
                }
                return selected;
            };

            const auto search = [&](const auto& self) -> bool {
                if (isComplete())
                    return validate();

                Cell* target = selectCell();
                if (target == nullptr)
                    return false;

                std::vector<unsigned short> candidates = target->candidateList();
                if (randomizeCandidates)
                    std::shuffle(candidates.begin(), candidates.end(), engine);

                const GridSnapshot branchSnapshot = snapshot();
                const std::size_t branchEventCount = trace == nullptr ? 0 : trace->eventCount();
                for (unsigned short digit : candidates) {
                    restoreSnapshot(branchSnapshot);
                    if (trace != nullptr)
                        trace->truncate(branchEventCount);
                    if (!canPlace(target->row(), target->col(), digit))
                        continue;

                    try {
                        const std::string detail = "Aucune deduction logique ne progresse : "
                            + cellLabel(*target) + " est essayee avec le chiffre " + std::to_string(digit) + ".";
                        recordAssignment(
                            *target,
                            digit,
                            SolveTechnique::SearchGuess,
                            "Hypothese",
                            detail,
                            trace
                        );
                        propagateConstraints(trace);
                        if (validate() && self(self))
                            return true;
                    } catch (const std::logic_error&) {
                    }
                }

                restoreSnapshot(branchSnapshot);
                if (trace != nullptr)
                    trace->truncate(branchEventCount);
                return false;
            };

            try {
                propagateConstraints(trace);
                if (validate() && search(search))
                    return true;
            } catch (const std::logic_error&) {
            }

            restoreSnapshot(originalSnapshot);
            if (trace != nullptr)
                trace->truncate(originalEventCount);
            return false;
        }
};

class SudokuGenerator {
    private:
        static std::vector<short> shuffledIndices(short count, std::mt19937& engine) {
            std::vector<short> indices(count);
            std::iota(indices.begin(), indices.end(), 0);
            std::shuffle(indices.begin(), indices.end(), engine);
            return indices;
        }

        static std::vector<short> shuffledHouseOrder(short groupCount, short groupSize, std::mt19937& engine) {
            const std::vector<short> groups = shuffledIndices(groupCount, engine);
            std::vector<short> order;
            order.reserve(groupCount * groupSize);

            for (short group : groups) {
                const std::vector<short> localIndices = shuffledIndices(groupSize, engine);
                for (short localIndex : localIndices)
                    order.push_back(static_cast<short>(group * groupSize + localIndex));
            }

            return order;
        }

        static std::vector<std::vector<unsigned short>> buildSolution(const Grille& grid, std::mt19937& engine) {
            const short size = static_cast<short>(grid.getSize());
            const short boxHeight = static_cast<short>(grid.boxHeight());
            const short boxWidth = static_cast<short>(grid.boxWidth());
            const std::vector<short> rowOrder = shuffledHouseOrder(size / boxHeight, boxHeight, engine);
            const std::vector<short> columnOrder = shuffledHouseOrder(size / boxWidth, boxWidth, engine);
            std::vector<unsigned short> digitOrder(size);
            std::iota(digitOrder.begin(), digitOrder.end(), 1);
            std::shuffle(digitOrder.begin(), digitOrder.end(), engine);

            std::vector<std::vector<unsigned short>> solution(size, std::vector<unsigned short>(size));
            for (short row = 0; row < size; ++row) {
                for (short col = 0; col < size; ++col) {
                    const short sourceRow = rowOrder[row];
                    const short sourceCol = columnOrder[col];
                    const short shift = static_cast<short>((sourceRow % boxHeight) * boxWidth + sourceRow / boxHeight);
                    const short patternIndex = static_cast<short>((shift + sourceCol) % size);
                    solution[row][col] = digitOrder[patternIndex];
                }
            }

            return solution;
        }

        static void placeClues(
            Grille& grid,
            const std::vector<std::vector<unsigned short>>& solution,
            std::size_t clueCount,
            std::mt19937& engine
        ) {
            const short size = static_cast<short>(grid.getSize());
            std::vector<short> positions(size * size);
            std::iota(positions.begin(), positions.end(), 0);
            std::shuffle(positions.begin(), positions.end(), engine);

            for (std::size_t index = 0; index < clueCount; ++index) {
                const short position = positions[index];
                const short row = static_cast<short>(position / size);
                const short col = static_cast<short>(position % size);
                grid.setCellValue(row, col, solution[row][col], true, false);
            }
        }

    public:
        static std::vector<std::vector<unsigned short>> generateSolvedGrid(
            const Grille& grid,
            std::uint32_t seed = std::random_device{}()
        ) {
            std::mt19937 engine(seed);
            return buildSolution(grid, engine);
        }

        static std::vector<std::vector<unsigned short>> generateClassicPuzzle(
            Grille& grid,
            std::size_t clueCount,
            std::uint32_t seed = std::random_device{}()
        ) {
            const std::size_t cellCount = static_cast<std::size_t>(grid.getSize()) * grid.getSize();
            if (clueCount > cellCount)
                throw std::invalid_argument("The clue count exceeds the number of cells.");

            std::mt19937 engine(seed);
            const std::vector<std::vector<unsigned short>> solution = buildSolution(grid, engine);
            grid.reset();
            placeClues(grid, solution, clueCount, engine);
            return solution;
        }

        static std::vector<std::vector<unsigned short>> generateUniqueClassicPuzzle(
            Grille& grid,
            std::size_t clueCount = 32,
            std::size_t maxAttempts = 32,
            std::uint32_t seed = std::random_device{}()
        ) {
            if (maxAttempts == 0)
                throw std::invalid_argument("At least one unique-generation attempt is required.");

            for (std::size_t attempt = 0; attempt < maxAttempts; ++attempt) {
                const std::vector<std::vector<unsigned short>> solution = generateClassicPuzzle(
                    grid,
                    clueCount,
                    static_cast<std::uint32_t>(seed + attempt)
                );
                if (grid.countSolutions(2) == 1)
                    return solution;
            }

            throw std::runtime_error("Unable to generate a unique Sudoku within the attempt limit.");
        }

        static std::vector<std::vector<unsigned short>> generateKillerPuzzle(
            Grille& grid,
            std::size_t maxCageSize = 5,
            std::size_t clueCount = 0,
            std::uint32_t seed = std::random_device{}()
        ) {
            const short size = static_cast<short>(grid.getSize());
            const std::size_t cellCount = static_cast<std::size_t>(size) * size;
            if (maxCageSize == 0)
                throw std::invalid_argument("A cage must contain at least one cell.");
            if (clueCount > cellCount)
                throw std::invalid_argument("The clue count exceeds the number of cells.");

            std::mt19937 engine(seed);
            const std::vector<std::vector<unsigned short>> solution = buildSolution(grid, engine);
            grid.reset();
            std::vector<bool> assigned(cellCount, false);

            for (short start = 0; start < static_cast<short>(cellCount); ++start) {
                if (assigned[start])
                    continue;

                std::uniform_int_distribution<std::size_t> cageSizeDistribution(1, maxCageSize);
                const std::size_t desiredSize = cageSizeDistribution(engine);
                std::vector<short> cagePositions = { start };
                assigned[start] = true;

                while (cagePositions.size() < desiredSize) {
                    std::vector<short> frontier;
                    for (short position : cagePositions) {
                        const short row = static_cast<short>(position / size);
                        const short col = static_cast<short>(position % size);
                        const std::vector<std::pair<short, short>> neighbours = {
                            { static_cast<short>(row - 1), col },
                            { static_cast<short>(row + 1), col },
                            { row, static_cast<short>(col - 1) },
                            { row, static_cast<short>(col + 1) }
                        };
                        for (const auto& [neighbourRow, neighbourCol] : neighbours) {
                            if (neighbourRow < 0 || neighbourRow >= size || neighbourCol < 0 || neighbourCol >= size)
                                continue;
                            const short neighbour = static_cast<short>(neighbourRow * size + neighbourCol);
                            const bool duplicatesCageDigit = std::any_of(
                                cagePositions.begin(),
                                cagePositions.end(),
                                [&](short position) {
                                    return solution[position / size][position % size]
                                        == solution[neighbourRow][neighbourCol];
                                }
                            );
                            if (!assigned[neighbour] && !duplicatesCageDigit
                                && std::find(frontier.begin(), frontier.end(), neighbour) == frontier.end())
                                frontier.push_back(neighbour);
                        }
                    }

                    if (frontier.empty())
                        break;

                    std::uniform_int_distribution<std::size_t> frontierDistribution(0, frontier.size() - 1);
                    const short next = frontier[frontierDistribution(engine)];
                    cagePositions.push_back(next);
                    assigned[next] = true;
                }

                std::vector<std::pair<short, short>> coordinates;
                unsigned short sum = 0;
                for (short position : cagePositions) {
                    const short row = static_cast<short>(position / size);
                    const short col = static_cast<short>(position % size);
                    coordinates.push_back({ row, col });
                    sum = static_cast<unsigned short>(sum + solution[row][col]);
                }
                grid.addCage(sum, coordinates);
            }

            placeClues(grid, solution, clueCount, engine);
            return solution;
        }

        static std::vector<std::vector<unsigned short>> generateUniqueKillerPuzzle(
            Grille& grid,
            std::size_t maxCageSize = 5,
            std::size_t clueCount = 0,
            std::size_t maxAttempts = 32,
            std::uint32_t seed = std::random_device{}()
        ) {
            if (maxAttempts == 0)
                throw std::invalid_argument("At least one unique-generation attempt is required.");

            for (std::size_t attempt = 0; attempt < maxAttempts; ++attempt) {
                const std::vector<std::vector<unsigned short>> solution = generateKillerPuzzle(
                    grid,
                    maxCageSize,
                    clueCount,
                    static_cast<std::uint32_t>(seed + attempt)
                );
                if (grid.countSolutions(2) == 1)
                    return solution;
            }

            throw std::runtime_error("Unable to generate a unique Killer Sudoku within the attempt limit.");
        }
};

class SudokuSolver {
    private:
        Grille grid_;
        PuzzleType puzzleType_;

    public:
        explicit SudokuSolver(
            unsigned short size,
            unsigned short boxHeight = 0,
            unsigned short boxWidth = 0,
            PuzzleType puzzleType = PuzzleType::KillerSudoku
        ) : grid_(size, boxHeight, boxWidth), puzzleType_(puzzleType) {
        }

        PuzzleType puzzleType() const {
            return puzzleType_;
        }

        void setPuzzleType(PuzzleType puzzleType) {
            puzzleType_ = puzzleType;
            grid_.reset();
        }

        std::vector<std::vector<unsigned short>> generateUniquePuzzle(
            std::size_t clueCount,
            std::size_t maxCageSize = 5,
            std::size_t maxAttempts = 32,
            std::uint32_t seed = std::random_device{}()
        ) {
            if (puzzleType_ == PuzzleType::Sudoku)
                return SudokuGenerator::generateUniqueClassicPuzzle(grid_, clueCount, maxAttempts, seed);
            return SudokuGenerator::generateUniqueKillerPuzzle(grid_, maxCageSize, clueCount, maxAttempts, seed);
        }

        Grille& grid() {
            return grid_;
        }

        const Grille& grid() const {
            return grid_;
        }
};

inline void SolverTrace::captureInitial(const Grille& grid, const std::string& title, const std::string& detail) {
    initialSnapshot_ = grid.snapshot();
    initialTitle_ = title;
    initialDetail_ = detail;
    hasInitialSnapshot_ = true;
}

inline void SolverTrace::recordEvent(
    SolveTechnique technique,
    const std::string& title,
    const std::string& detail,
    const std::vector<CandidateRemoval>& removals,
    const std::vector<ValueAssignment>& assignments,
    const Grille& grid
) {
    if (removals.empty() && assignments.empty())
        return;

    if (!hasInitialSnapshot_)
        captureInitial(grid);

    events_.push_back({
        technique,
        title,
        detail,
        removals,
        assignments,
        grid.snapshot()
    });
}

inline void HtmlTraceRenderer::writeToStream(const Grille& grid, const SolverTrace& trace, std::ostream& output, const std::string& title) {
    const GridSnapshot fallbackSnapshot = grid.snapshot();
    const GridSnapshot& initialSnapshot = trace.hasInitialSnapshot() ? trace.initialSnapshot() : fallbackSnapshot;

    auto escapeForJs = [](const std::string& value) {
        std::string escaped;
        escaped.reserve(value.size() + 16);
        for (char character : value) {
            switch (character) {
                case '\\':
                    escaped += "\\\\";
                    break;
                case '"':
                    escaped += "\\\"";
                    break;
                case '\n':
                    escaped += "\\n";
                    break;
                case '\r':
                    break;
                case '\t':
                    escaped += "\\t";
                    break;
                default:
                    escaped += character;
                    break;
            }
        }
        return escaped;
    };

    auto writeSnapshot = [&](std::ostream& output, const GridSnapshot& snapshot) {
        output << "{size:" << snapshot.size
               << ",boxHeight:" << snapshot.boxHeight
               << ",boxWidth:" << snapshot.boxWidth
               << ",cells:[";
        for (std::size_t index = 0; index < snapshot.cells.size(); ++index) {
            if (index != 0)
                output << ",";
            output << "{value:" << snapshot.cells[index].value
                   << ",isFixed:" << (snapshot.cells[index].isFixed ? "true" : "false")
                   << ",isUserEntered:" << (snapshot.cells[index].isUserEntered ? "true" : "false")
                   << ",candidates:[";
            for (std::size_t candidateIndex = 0; candidateIndex < snapshot.cells[index].candidates.size(); ++candidateIndex) {
                if (candidateIndex != 0)
                    output << ",";
                output << (snapshot.cells[index].candidates[candidateIndex] ? "true" : "false");
            }
            output << "]}";
        }
        output << "]}";
    };

    output << "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"UTF-8\">\n";
    output << "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n";
    output << "<title>" << escapeForJs(title) << "</title>\n";
    output << "<style>\n";
    output << "body{font-family:Arial,sans-serif;margin:0;background:#f2f2f2;color:#111;}\n";
    output << ".layout{display:grid;grid-template-columns:minmax(320px,1fr) 360px;gap:20px;padding:20px;align-items:start;}\n";
    output << ".side{display:flex;flex-direction:column;gap:20px;}\n";
    output << ".panel{background:#fff;border:1px solid #d0d0d0;border-radius:14px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,.08);}\n";
    output << ".toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;}\n";
    output << "button{border:1px solid #222;background:#fff;padding:8px 12px;border-radius:10px;cursor:pointer;}\n";
    output << "button:hover{background:#111;color:#fff;}\n";
    output << "button.selected{background:#1e5eff;color:#fff;border-color:#1e5eff;}\n";
    output << "input[type=range]{flex:1;min-width:160px;}\n";
    output << "#board{width:min(90vw,900px);height:auto;background:white;border-radius:10px;}\n";
    output << ".muted{color:#666;font-size:14px;}\n";
    output << ".mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}\n";
    output << ".list{display:flex;flex-direction:column;gap:8px;max-height:240px;overflow:auto;}\n";
    output << ".badge{display:inline-block;border-radius:999px;padding:4px 10px;background:#111;color:#fff;font-size:12px;}\n";
    output << ".keypad{display:grid;grid-template-columns:repeat(3,minmax(42px,1fr));gap:6px;margin-top:16px;}\n";
    output << ".keypad button{min-width:42px;}\n";
    output << ".keypad .erase{grid-column:1 / -1;}\n";
    output << "@media (max-width:1100px){.layout{grid-template-columns:1fr;}.side{order:-1;}}\n";
    output << "</style>\n</head>\n<body>\n";
    output << "<div class=\"layout\">\n";
    output << "<div class=\"panel\">\n";
    output << "<div class=\"toolbar\">\n";
    output << "<button id=\"prev\">Etape precedente</button>\n";
    output << "<input id=\"stepSlider\" type=\"range\" min=\"0\" max=\"" << trace.events().size() << "\" value=\"0\">\n";
    output << "<button id=\"next\">Etape suivante</button>\n";
    output << "<span id=\"stepLabel\" class=\"badge\"></span>\n";
    output << "</div>\n";
    output << "<div class=\"toolbar\">\n";
    output << "<button id=\"manualToggle\">Mode manuel</button>\n";
    output << "<button id=\"entryToggle\">Entrer une valeur</button>\n";
    output << "<button id=\"manualReset\">Reinitialiser la saisie</button>\n";
    output << "<button id=\"manualUndo\">Annuler</button>\n";
    output << "<button id=\"manualRedo\">Retablir</button>\n";
    output << "<button id=\"manualSave\">Sauvegarder</button>\n";
    output << "<button id=\"manualLoad\">Restaurer</button>\n";
    output << "<label class=\"muted\"><input id=\"autoCandidates\" type=\"checkbox\" checked> Afficher les possibilites calculees</label>\n";
    output << "<label class=\"muted\"><input id=\"strictErrors\" type=\"checkbox\"> Afficher les erreurs en rouge</label>\n";
    output << "</div>\n";
    output << "<div class=\"muted\">Utilisez les fleches gauche et droite pour naviguer entre les etapes.</div>\n";
    output << "<div class=\"muted\">Noir : indice genere · Bleu : valeur saisie manuellement</div>\n";
    output << "<svg id=\"board\"></svg>\n";
    output << "</div>\n";
    output << "<div class=\"side\">\n";
    output << "<div class=\"panel\">\n";
    output << "<h2 id=\"traceTitle\" style=\"margin-top:0;\">" << escapeForJs(title) << "</h2>\n";
    output << "<div id=\"eventTitle\" style=\"font-weight:700;margin-bottom:6px;\"></div>\n";
    output << "<div id=\"eventDetail\" class=\"muted\" style=\"margin-bottom:12px;\"></div>\n";
    output << "<div id=\"selectedCageInfo\" class=\"badge\" style=\"margin-bottom:12px;\"></div>\n";
    output << "<div class=\"muted\" style=\"margin-bottom:6px;\">Modifications de l'etape</div>\n";
    output << "<div id=\"eventChanges\" class=\"list mono\"></div>\n";
    output << "<div id=\"keypad\" class=\"keypad\"></div>\n";
    output << "</div>\n";
    output << "<div class=\"panel\">\n";
    output << "<h3 style=\"margin-top:0;margin-bottom:8px;\">Generation</h3>\n";
    output << "<div class=\"toolbar\"><button id=\"generateSudoku\">Generer un Sudoku</button><button id=\"generateKiller\">Generer un Sudoku Killer</button></div>\n";
    output << "<div class=\"toolbar\"><label class=\"muted\" for=\"generationDifficulty\">Difficulte</label><select id=\"generationDifficulty\"><option value=\"facile\">Facile</option><option value=\"moyen\" selected>Moyen</option><option value=\"difficile\">Difficile</option></select></div>\n";
    output << "<div id=\"generationChoice\" class=\"muted\"></div>\n";
    output << "</div>\n";
    output << "</div>\n";
    output << "<script>\n";
    output << "const traceData={title:\"" << escapeForJs(title) << "\",puzzleType:\""
           << (grid.cages().empty() ? "sudoku" : "killer") << "\",initialTitle:\""
           << escapeForJs(trace.hasInitialSnapshot() ? trace.initialTitle() : "Etat initial")
           << "\",initialDetail:\""
           << escapeForJs(trace.hasInitialSnapshot() ? trace.initialDetail() : "")
           << "\",initialSnapshot:";
    writeSnapshot(output, initialSnapshot);
    output << ",cages:[";
    for (std::size_t cageIndex = 0; cageIndex < grid.cages().size(); ++cageIndex) {
        if (cageIndex != 0)
            output << ",";
        const auto& cage = grid.cages()[cageIndex];
        output << "{sum:" << cage.targetSum() << ",cells:[";
        for (std::size_t cellIndex = 0; cellIndex < cage.cells().size(); ++cellIndex) {
            if (cellIndex != 0)
                output << ",";
            output << "{row:" << cage.cells()[cellIndex]->row() << ",col:" << cage.cells()[cellIndex]->col() << "}";
        }
        output << "]}";
    }
    output << "],steps:[";
    for (std::size_t eventIndex = 0; eventIndex < trace.events().size(); ++eventIndex) {
        if (eventIndex != 0)
            output << ",";
        const TraceEvent& event = trace.events()[eventIndex];
        output << "{title:\"" << escapeForJs(event.title) << "\",detail:\""
               << escapeForJs(event.detail) << "\",removals:[";
        for (std::size_t removalIndex = 0; removalIndex < event.removals.size(); ++removalIndex) {
            if (removalIndex != 0)
                output << ",";
            const CandidateRemoval& removal = event.removals[removalIndex];
            output << "{row:" << removal.row << ",col:" << removal.col << ",digit:" << removal.digit << "}";
        }
        output << "],assignments:[";
        for (std::size_t assignmentIndex = 0; assignmentIndex < event.assignments.size(); ++assignmentIndex) {
            if (assignmentIndex != 0)
                output << ",";
            const ValueAssignment& assignment = event.assignments[assignmentIndex];
            output << "{row:" << assignment.row << ",col:" << assignment.col << ",value:" << assignment.value << "}";
        }
        output << "],snapshot:";
        writeSnapshot(output, event.snapshot);
        output << "}";
    }
    output << "]};\n";

    output << R"JS(
const board = document.getElementById('board');
const slider = document.getElementById('stepSlider');
const stepLabel = document.getElementById('stepLabel');
const eventTitle = document.getElementById('eventTitle');
const eventDetail = document.getElementById('eventDetail');
const selectedCageInfo = document.getElementById('selectedCageInfo');
const generateSudoku = document.getElementById('generateSudoku');
const generateKiller = document.getElementById('generateKiller');
const generationDifficulty = document.getElementById('generationDifficulty');
const generationChoice = document.getElementById('generationChoice');
const eventChanges = document.getElementById('eventChanges');
const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');
const manualToggle = document.getElementById('manualToggle');
const entryToggle = document.getElementById('entryToggle');
const manualReset = document.getElementById('manualReset');
const manualUndo = document.getElementById('manualUndo');
const manualRedo = document.getElementById('manualRedo');
const manualSave = document.getElementById('manualSave');
const manualLoad = document.getElementById('manualLoad');
const autoCandidates = document.getElementById('autoCandidates');
const strictErrors = document.getElementById('strictErrors');
const keypad = document.getElementById('keypad');
let manualMode = false;
let pencilMode = false;
let activeCell = null;
let manualSnapshot = JSON.parse(JSON.stringify(traceData.initialSnapshot));
let manualHistory = [JSON.parse(JSON.stringify(manualSnapshot))];
let manualHistoryIndex = 0;
let selectedGenerationType = localStorage.getItem('sudoku-generation-type') || traceData.puzzleType;
let selectedGenerationDifficulty = localStorage.getItem('sudoku-generation-difficulty') || 'moyen';

function updateGenerationChoice() {
  const isSudoku = selectedGenerationType === 'sudoku';
  generateSudoku.classList.toggle('selected', isSudoku);
  generateKiller.classList.toggle('selected', !isSudoku);
  generationDifficulty.value = selectedGenerationDifficulty;
  generationChoice.textContent = window.location.protocol === 'http:'
    ? `Prochaine generation : ${isSudoku ? 'Sudoku' : 'Sudoku Killer'} ${selectedGenerationDifficulty}.`
    : 'Ouvrez cette page avec le serveur local pour generer une nouvelle grille.';
}

function currentState(index) {
  if (index === 0) {
    return {
      title: traceData.initialTitle || 'Etat initial',
      detail: traceData.initialDetail || '',
      removals: [],
      assignments: [],
      snapshot: traceData.initialSnapshot
    };
  }
  return traceData.steps[index - 1];
}

function candidateKey(row, col, digit) {
  return `${row}:${col}:${digit}`;
}

function forcedCandidateKeys(snapshot) {
  const forced = new Set();
  const size = snapshot.size;
  const markHouseSingles = indexes => {
    for (let digit = 1; digit <= size; digit += 1) {
      const candidates = indexes.filter(index => {
        const cell = snapshot.cells[index];
        return cell.value === 0 && cell.candidates[digit - 1];
      });
      if (candidates.length === 1) forced.add(`${candidates[0]}:${digit}`);
    }
  };

  snapshot.cells.forEach((cell, index) => {
    if (cell.value !== 0) return;
    const candidates = cell.candidates.filter(Boolean);
    if (candidates.length === 1) forced.add(`${index}:${cell.candidates.findIndex(Boolean) + 1}`);
  });
  for (let row = 0; row < size; row += 1) markHouseSingles(Array.from({ length: size }, (_, col) => row * size + col));
  for (let col = 0; col < size; col += 1) markHouseSingles(Array.from({ length: size }, (_, row) => row * size + col));
  for (let boxRow = 0; boxRow < size; boxRow += snapshot.boxHeight) {
    for (let boxCol = 0; boxCol < size; boxCol += snapshot.boxWidth) {
      const indexes = [];
      for (let row = 0; row < snapshot.boxHeight; row += 1) {
        for (let col = 0; col < snapshot.boxWidth; col += 1) indexes.push((boxRow + row) * size + boxCol + col);
      }
      markHouseSingles(indexes);
    }
  }
  return forced;
}

function ensureManualNotes(snapshot) {
  snapshot.cells.forEach(cell => {
    if (!Array.isArray(cell.manualNotes)) cell.manualNotes = Array(snapshot.size).fill(false);
  });
}

function errorCellIndexes(snapshot) {
  const errors = new Set();
  const size = snapshot.size;
  const markUserEntries = indexes => {
    indexes.forEach(index => {
      if (snapshot.cells[index].isUserEntered) errors.add(index);
    });
  };
  const inspectHouse = indexes => {
    const positionsByValue = new Map();
    indexes.forEach(index => {
      const value = snapshot.cells[index].value;
      if (!value) return;
      const positions = positionsByValue.get(value) || [];
      positions.push(index);
      positionsByValue.set(value, positions);
    });
    positionsByValue.forEach(positions => {
      if (positions.length > 1) markUserEntries(positions);
    });
  };

  for (let row = 0; row < size; row += 1) {
    inspectHouse(Array.from({ length: size }, (_, col) => row * size + col));
  }
  for (let col = 0; col < size; col += 1) {
    inspectHouse(Array.from({ length: size }, (_, row) => row * size + col));
  }
  for (let boxRow = 0; boxRow < size; boxRow += snapshot.boxHeight) {
    for (let boxCol = 0; boxCol < size; boxCol += snapshot.boxWidth) {
      const indexes = [];
      for (let row = 0; row < snapshot.boxHeight; row += 1) {
        for (let col = 0; col < snapshot.boxWidth; col += 1) {
          indexes.push((boxRow + row) * size + boxCol + col);
        }
      }
      inspectHouse(indexes);
    }
  }

  traceData.cages.forEach(cage => {
    const indexes = cage.cells.map(cell => cell.row * size + cell.col);
    inspectHouse(indexes);
    const solvedIndexes = indexes.filter(index => snapshot.cells[index].value !== 0);
    const currentSum = solvedIndexes.reduce((sum, index) => sum + snapshot.cells[index].value, 0);
    if (currentSum > cage.sum || (solvedIndexes.length === indexes.length && currentSum !== cage.sum)) {
      markUserEntries(solvedIndexes);
    }
  });
  return errors;
}

function drawBoard(state) {
  const snapshot = state.snapshot;
  const size = snapshot.size;
  const cellSize = Math.max(54, Math.floor(720 / size));
  const margin = 24;
  const width = margin * 2 + cellSize * size;
  const height = margin * 2 + cellSize * size;
  const candidateCols = Math.ceil(Math.sqrt(size));
  const candidateRows = Math.ceil(size / candidateCols);
  const removedNow = new Set(state.removals.map(item => candidateKey(item.row, item.col, item.digit)));
  const assignedNow = new Set(state.assignments.map(item => `${item.row}:${item.col}`));
  const errorIndexes = manualMode && strictErrors.checked ? errorCellIndexes(snapshot) : new Set();
  const forcedCandidates = manualMode && autoCandidates.checked ? forcedCandidateKeys(snapshot) : new Set();
  const selectedValue = manualMode && autoCandidates.checked && activeCell
    ? snapshot.cells[activeCell.row * size + activeCell.col].value
    : 0;

  board.setAttribute('viewBox', `0 0 ${width} ${height}`);
  board.innerHTML = '';

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', width);
  background.setAttribute('height', height);
  background.setAttribute('fill', '#ffffff');
  board.appendChild(background);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const index = row * size + col;
      const cell = snapshot.cells[index];
      const x = margin + col * cellSize;
      const y = margin + row * cellSize;
      const isError = errorIndexes.has(index);

      const cellRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      cellRect.setAttribute('x', x);
      cellRect.setAttribute('y', y);
      cellRect.setAttribute('width', cellSize);
      cellRect.setAttribute('height', cellSize);
      const isActive = manualMode && activeCell && activeCell.row === row && activeCell.col === col;
      cellRect.setAttribute('fill', isError ? '#ffe2e2' : (assignedNow.has(`${row}:${col}`) ? '#e8fff0' : '#ffffff'));
      cellRect.setAttribute('stroke', isError ? '#d11a2a' : '#d7d7d7');
      cellRect.setAttribute('stroke-width', isError ? '2' : '1');
      board.appendChild(cellRect);

      if (cell.value !== 0) {
        const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        valueText.setAttribute('x', x + cellSize / 2);
        valueText.setAttribute('y', y + cellSize / 2 + cellSize * 0.17);
        valueText.setAttribute('text-anchor', 'middle');
        valueText.setAttribute('font-size', Math.max(24, cellSize * 0.58));
        valueText.setAttribute('font-weight', '700');
        valueText.setAttribute('font-family', 'Arial, sans-serif');
        valueText.setAttribute('fill', isError ? '#d11a2a' : (cell.isUserEntered ? '#1463c6' : '#111111'));
        valueText.textContent = cell.value;
        board.appendChild(valueText);
      } else {
        const miniWidth = cellSize / candidateCols;
        const miniHeight = cellSize / candidateRows;

        for (let digit = 1; digit <= size; digit += 1) {
          const candidateIndex = digit - 1;
          const miniCol = candidateIndex % candidateCols;
          const miniRow = Math.floor(candidateIndex / candidateCols);
          const miniX = x + miniCol * miniWidth;
          const miniY = y + miniRow * miniHeight;
          const allowed = cell.candidates[candidateIndex];
          const visible = manualMode
            ? (autoCandidates.checked ? allowed : Boolean(cell.manualNotes && cell.manualNotes[candidateIndex]))
            : allowed;
          const removedHighlight = removedNow.has(candidateKey(row, col, digit));
          const forcedHighlight = forcedCandidates.has(`${index}:${digit}`);
          const selectedValueHighlight = selectedValue === digit;

          const miniRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          miniRect.setAttribute('x', miniX + 1);
          miniRect.setAttribute('y', miniY + 1);
          miniRect.setAttribute('width', miniWidth - 2);
          miniRect.setAttribute('height', miniHeight - 2);
          miniRect.setAttribute('fill', removedHighlight ? '#ffdede' : (forcedHighlight && visible ? '#1c9c5a' : (selectedValueHighlight && visible ? '#7b3fc6' : (visible ? '#111111' : '#ffffff'))));
          miniRect.setAttribute('stroke', removedHighlight ? '#d11a2a' : (forcedHighlight && visible ? '#087b42' : (selectedValueHighlight && visible ? '#54238e' : '#dcdcdc')));
          miniRect.setAttribute('stroke-width', removedHighlight ? '1.5' : '0.8');
          board.appendChild(miniRect);

          const miniText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          miniText.setAttribute('x', miniX + miniWidth / 2);
          miniText.setAttribute('y', miniY + miniHeight / 2 + 4);
          miniText.setAttribute('text-anchor', 'middle');
          miniText.setAttribute('font-size', Math.max(8, Math.min(miniWidth, miniHeight) * 0.42));
          miniText.setAttribute('font-family', 'Arial, sans-serif');
          miniText.setAttribute('fill', removedHighlight ? '#d11a2a' : (visible ? '#ffffff' : '#b8b8b8'));
          miniText.textContent = manualMode && !visible ? '' : digit;
          board.appendChild(miniText);
        }
      }

      if (isActive) {
        const selection = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        selection.setAttribute('x', x + 2);
        selection.setAttribute('y', y + 2);
        selection.setAttribute('width', cellSize - 4);
        selection.setAttribute('height', cellSize - 4);
        selection.setAttribute('fill', pencilMode ? '#c084fc' : '#ffd54f');
        selection.setAttribute('fill-opacity', '.28');
        selection.setAttribute('stroke', pencilMode ? '#7b3fc6' : '#d18a00');
        selection.setAttribute('stroke-width', '3');
        selection.style.pointerEvents = 'none';
        board.appendChild(selection);
      }

      if (manualMode) {
        const hitTarget = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hitTarget.setAttribute('x', x);
        hitTarget.setAttribute('y', y);
        hitTarget.setAttribute('width', cellSize);
        hitTarget.setAttribute('height', cellSize);
        hitTarget.setAttribute('fill', 'transparent');
        hitTarget.style.cursor = cell.isFixed ? 'not-allowed' : 'pointer';
        hitTarget.addEventListener('click', () => {
          activeCell = { row, col };
          renderManual();
        });
        board.appendChild(hitTarget);
      }
    }
  }

  for (let row = 0; row <= size; row += 1) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', margin);
    line.setAttribute('x2', margin + cellSize * size);
    line.setAttribute('y1', margin + row * cellSize);
    line.setAttribute('y2', margin + row * cellSize);
    line.setAttribute('stroke', '#444');
    line.setAttribute('stroke-width', row % snapshot.boxHeight === 0 ? '3' : '1');
    board.appendChild(line);
  }

  for (let col = 0; col <= size; col += 1) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('y1', margin);
    line.setAttribute('y2', margin + cellSize * size);
    line.setAttribute('x1', margin + col * cellSize);
    line.setAttribute('x2', margin + col * cellSize);
    line.setAttribute('stroke', '#444');
    line.setAttribute('stroke-width', col % snapshot.boxWidth === 0 ? '3' : '1');
    board.appendChild(line);
  }

  const activeCellKey = activeCell ? `${activeCell.row}:${activeCell.col}` : '';
  traceData.cages.forEach(cage => {
    const selectedCage = manualMode && cage.cells.some(cell => `${cell.row}:${cell.col}` === activeCellKey);
    const inside = new Set(cage.cells.map(cell => `${cell.row}:${cell.col}`));
    cage.cells.forEach(cell => {
      const x = margin + cell.col * cellSize;
      const y = margin + cell.row * cellSize;
      const edges = [
        { dx: 0, dy: -1, x1: x + 5, y1: y + 5, x2: x + cellSize - 5, y2: y + 5 },
        { dx: 1, dy: 0, x1: x + cellSize - 5, y1: y + 5, x2: x + cellSize - 5, y2: y + cellSize - 5 },
        { dx: 0, dy: 1, x1: x + 5, y1: y + cellSize - 5, x2: x + cellSize - 5, y2: y + cellSize - 5 },
        { dx: -1, dy: 0, x1: x + 5, y1: y + 5, x2: x + 5, y2: y + cellSize - 5 }
      ];
      edges.forEach(edge => {
        if (!inside.has(`${cell.row + edge.dy}:${cell.col + edge.dx}`)) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', edge.x1);
          line.setAttribute('y1', edge.y1);
          line.setAttribute('x2', edge.x2);
          line.setAttribute('y2', edge.y2);
          line.setAttribute('stroke', selectedCage ? (pencilMode ? '#7b3fc6' : '#d18a00') : '#1e5eff');
          line.setAttribute('stroke-width', selectedCage ? '4' : '2');
          line.setAttribute('stroke-dasharray', '6 4');
          board.appendChild(line);
        }
      });
    });

    if (cage.cells.length > 0) {
      const anchor = cage.cells.slice().sort((a, b) => (a.row - b.row) || (a.col - b.col))[0];
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', margin + anchor.col * cellSize + 8);
      label.setAttribute('y', margin + anchor.row * cellSize + 16);
      label.setAttribute('font-size', Math.max(10, cellSize * 0.16));
      label.setAttribute('font-family', 'Arial, sans-serif');
      label.setAttribute('fill', selectedCage ? (pencilMode ? '#7b3fc6' : '#d18a00') : '#74c7ff');
      label.setAttribute('font-weight', '700');
      label.textContent = cage.sum;
      board.appendChild(label);
    }
  });
}

function applySumConstraint(snapshot, indexes, targetSum) {
  const size = snapshot.size;
  const solvedValues = new Set();
  let solvedSum = 0;
  const unresolved = [];
  indexes.forEach(index => {
    const cell = snapshot.cells[index];
    if (cell.value) {
      solvedSum += cell.value;
      solvedValues.add(cell.value);
    } else {
      unresolved.push(index);
    }
  });
  if (!unresolved.length || solvedSum > targetSum) return false;

  const allowed = unresolved.map(() => Array(size).fill(false));
  const visit = (position, remaining, used) => {
    if (position === unresolved.length) return remaining === 0;
    const cell = snapshot.cells[unresolved[position]];
    let branchFound = false;
    for (let digit = 1; digit <= size; digit += 1) {
      if (!cell.candidates[digit - 1] || digit > remaining || used.has(digit)) continue;
      const nextUsed = new Set(used);
      nextUsed.add(digit);
      if (visit(position + 1, remaining - digit, nextUsed)) {
        allowed[position][digit - 1] = true;
        branchFound = true;
      }
    }
    return branchFound;
  };
  const found = visit(0, targetSum - solvedSum, solvedValues);
  if (!found) return false;

  let changed = false;
  unresolved.forEach((index, position) => {
    const cell = snapshot.cells[index];
    cell.candidates.forEach((candidate, digitIndex) => {
      if (candidate && !allowed[position][digitIndex]) {
        cell.candidates[digitIndex] = false;
        changed = true;
      }
    });
  });
  return changed;
}

function recalculateAllCandidates() {
  const snapshot = manualSnapshot;
  const size = snapshot.size;
  ensureManualNotes(snapshot);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = snapshot.cells[row * size + col];
      if (cell.value !== 0) continue;
      const forbidden = new Set();
      for (let index = 0; index < size; index += 1) {
        const rowValue = snapshot.cells[row * size + index].value;
        const colValue = snapshot.cells[index * size + col].value;
        if (rowValue) forbidden.add(rowValue);
        if (colValue) forbidden.add(colValue);
      }
      const boxRow = Math.floor(row / snapshot.boxHeight) * snapshot.boxHeight;
      const boxCol = Math.floor(col / snapshot.boxWidth) * snapshot.boxWidth;
      for (let offsetRow = 0; offsetRow < snapshot.boxHeight; offsetRow += 1) {
        for (let offsetCol = 0; offsetCol < snapshot.boxWidth; offsetCol += 1) {
          const value = snapshot.cells[(boxRow + offsetRow) * size + boxCol + offsetCol].value;
          if (value) forbidden.add(value);
        }
      }
      cell.candidates = Array.from({ length: size }, (_, index) => !forbidden.has(index + 1));
    }
  }

  let changed = false;
  do {
    changed = false;
    traceData.cages.forEach(cage => {
      const indexes = cage.cells.map(cell => cell.row * size + cell.col);
      changed = applySumConstraint(snapshot, indexes, cage.sum) || changed;
    });

    const houses = [];
    for (let row = 0; row < size; row += 1) houses.push(Array.from({ length: size }, (_, col) => row * size + col));
    for (let col = 0; col < size; col += 1) houses.push(Array.from({ length: size }, (_, row) => row * size + col));
    for (let boxRow = 0; boxRow < size; boxRow += snapshot.boxHeight) {
      for (let boxCol = 0; boxCol < size; boxCol += snapshot.boxWidth) {
        const indexes = [];
        for (let row = 0; row < snapshot.boxHeight; row += 1) {
          for (let col = 0; col < snapshot.boxWidth; col += 1) indexes.push((boxRow + row) * size + boxCol + col);
        }
        houses.push(indexes);
      }
    }
    houses.forEach(house => {
      const inside = new Set(house);
      const covered = new Set();
      let enclosedSum = 0;
      traceData.cages.forEach(cage => {
        const cageIndexes = cage.cells.map(cell => cell.row * size + cell.col);
        if (cageIndexes.every(index => inside.has(index))) {
          enclosedSum += cage.sum;
          cageIndexes.forEach(index => covered.add(index));
        }
      });
      if (covered.size) {
        const remaining = house.filter(index => !covered.has(index));
        if (remaining.length) changed = applySumConstraint(snapshot, remaining, size * (size + 1) / 2 - enclosedSum) || changed;
      }
    });
  } while (changed);

  snapshot.cells.forEach(cell => {
    if (cell.value !== 0) {
      cell.manualNotes = Array(size).fill(false);
      return;
    }
    cell.manualNotes.forEach((note, index) => {
      if (note && !cell.candidates[index]) cell.manualNotes[index] = false;
    });
  });
}

function updateHistoryButtons() {
  manualUndo.disabled = manualHistoryIndex === 0;
  manualRedo.disabled = manualHistoryIndex >= manualHistory.length - 1;
}

function pushManualHistory() {
  manualHistory = manualHistory.slice(0, manualHistoryIndex + 1);
  manualHistory.push(JSON.parse(JSON.stringify(manualSnapshot)));
  manualHistoryIndex = manualHistory.length - 1;
  updateHistoryButtons();
}

function restoreManualHistory(index) {
  if (index < 0 || index >= manualHistory.length) return;
  manualHistoryIndex = index;
  manualSnapshot = JSON.parse(JSON.stringify(manualHistory[manualHistoryIndex]));
  updateHistoryButtons();
  renderManual();
}

function applyDigit(digit) {
  if (!manualMode || !activeCell) return;
  const snapshot = manualSnapshot;
  const cell = snapshot.cells[activeCell.row * snapshot.size + activeCell.col];
  if (cell.isFixed) return;

  if (pencilMode) {
    if (cell.value !== 0) return;
    ensureManualNotes(snapshot);
    cell.manualNotes[digit - 1] = !cell.manualNotes[digit - 1];
  } else {
    if (cell.value === digit) {
      clearActiveCell();
      return;
    }
    cell.value = digit;
    cell.isFixed = false;
    cell.isUserEntered = true;
    cell.candidates = Array.from({ length: snapshot.size }, (_, index) => index + 1 === digit);
    cell.manualNotes = Array(snapshot.size).fill(false);
    recalculateAllCandidates();
  }
  pushManualHistory();
  renderManual();
}

function clearActiveCell() {
  if (!manualMode || !activeCell) return;
  const cell = manualSnapshot.cells[activeCell.row * manualSnapshot.size + activeCell.col];
  if (cell.isFixed) return;
  cell.value = 0;
  cell.isUserEntered = false;
  cell.candidates = Array(manualSnapshot.size).fill(true);
  cell.manualNotes = Array(manualSnapshot.size).fill(false);
  recalculateAllCandidates();
  pushManualHistory();
  renderManual();
}

function renderManual() {
  ensureManualNotes(manualSnapshot);
  stepLabel.textContent = pencilMode ? 'Notes' : 'Valeurs';
  eventTitle.textContent = 'Mode manuel';
  eventDetail.textContent = activeCell
    ? `Case selectionnee : r${activeCell.row + 1}c${activeCell.col + 1}.`
    : 'Cliquez une case, puis utilisez le clavier ou le pave numerique.';
  const selectedCage = activeCell && traceData.cages.find(cage => cage.cells.some(cell => cell.row === activeCell.row && cell.col === activeCell.col));
  selectedCageInfo.textContent = selectedCage ? `Cage selectionnee : somme ${selectedCage.sum}` : 'Aucune cage selectionnee';
  eventChanges.innerHTML = '';
  const line = document.createElement('div');
  line.textContent = pencilMode ? 'Saisie de possibilites activee.' : 'Saisie de valeurs finales activee.';
  eventChanges.appendChild(line);
  drawBoard({ snapshot: manualSnapshot, removals: [], assignments: [] });
}

function render(index) {
  if (manualMode) {
    renderManual();
    return;
  }
  const state = currentState(index);
  selectedCageInfo.textContent = '';
  stepLabel.textContent = `Etape ${index}/${traceData.steps.length}`;
  eventTitle.textContent = state.title || 'Etat';
  eventDetail.textContent = state.detail || '';
  eventChanges.innerHTML = '';

  state.assignments.forEach(item => {
    const line = document.createElement('div');
    line.textContent = `Validation: r${item.row + 1}c${item.col + 1} = ${item.value}`;
    eventChanges.appendChild(line);
  });

  state.removals.forEach(item => {
    const line = document.createElement('div');
    line.textContent = `Retrait: r${item.row + 1}c${item.col + 1} - ${item.digit}`;
    eventChanges.appendChild(line);
  });

  if (state.assignments.length === 0 && state.removals.length === 0) {
    const line = document.createElement('div');
    line.textContent = 'Aucune modification sur cette vue.';
    eventChanges.appendChild(line);
  }

  drawBoard(state);
}

function buildKeypad() {
  keypad.innerHTML = '';
  for (let digit = 1; digit <= traceData.initialSnapshot.size; digit += 1) {
    const key = document.createElement('button');
    key.textContent = digit;
    key.addEventListener('click', () => applyDigit(digit));
    keypad.appendChild(key);
  }
  const erase = document.createElement('button');
  erase.textContent = 'Effacer';
  erase.className = 'erase';
  erase.addEventListener('click', clearActiveCell);
  keypad.appendChild(erase);
}

manualToggle.addEventListener('click', () => {
  manualMode = !manualMode;
  activeCell = null;
  manualToggle.textContent = manualMode ? 'Voir la trace' : 'Mode manuel';
  slider.disabled = manualMode;
  prevButton.disabled = manualMode;
  nextButton.disabled = manualMode;
  render(Number(slider.value));
});
entryToggle.addEventListener('click', () => {
  if (!manualMode) return;
  pencilMode = !pencilMode;
  entryToggle.textContent = pencilMode ? 'Entrer une possibilite' : 'Entrer une valeur';
  renderManual();
});
manualReset.addEventListener('click', () => {
  if (!manualMode) return;
  manualSnapshot = JSON.parse(JSON.stringify(traceData.initialSnapshot));
  manualHistory = [JSON.parse(JSON.stringify(manualSnapshot))];
  manualHistoryIndex = 0;
  updateHistoryButtons();
  activeCell = null;
  renderManual();
});
manualUndo.addEventListener('click', () => restoreManualHistory(manualHistoryIndex - 1));
manualRedo.addEventListener('click', () => restoreManualHistory(manualHistoryIndex + 1));
strictErrors.addEventListener('change', () => {
  if (manualMode) renderManual();
});
autoCandidates.addEventListener('change', () => {
  if (!manualMode) return;
  if (autoCandidates.checked) recalculateAllCandidates();
  renderManual();
});
manualSave.addEventListener('click', () => {
  if (!manualMode) return;
  localStorage.setItem(`sudoku-manual:${traceData.title}`, JSON.stringify(manualSnapshot));
  eventDetail.textContent = 'Saisie manuelle sauvegardee dans ce navigateur.';
});
manualLoad.addEventListener('click', () => {
  if (!manualMode) return;
  const savedSnapshot = localStorage.getItem(`sudoku-manual:${traceData.title}`);
  if (!savedSnapshot) {
    eventDetail.textContent = 'Aucune sauvegarde locale pour cette grille.';
    return;
  }
  manualSnapshot = JSON.parse(savedSnapshot);
  manualHistory = [JSON.parse(JSON.stringify(manualSnapshot))];
  manualHistoryIndex = 0;
  updateHistoryButtons();
  activeCell = null;
  renderManual();
});
generateSudoku.addEventListener('click', () => {
  selectedGenerationType = 'sudoku';
  localStorage.setItem('sudoku-generation-type', selectedGenerationType);
  updateGenerationChoice();
  requestGeneration();
});
generateKiller.addEventListener('click', () => {
  selectedGenerationType = 'killer';
  localStorage.setItem('sudoku-generation-type', selectedGenerationType);
  updateGenerationChoice();
  requestGeneration();
});
generationDifficulty.addEventListener('change', () => {
  selectedGenerationDifficulty = generationDifficulty.value;
  localStorage.setItem('sudoku-generation-difficulty', selectedGenerationDifficulty);
  updateGenerationChoice();
});
function requestGeneration() {
  if (window.location.protocol !== 'http:') {
    generationChoice.textContent = 'Demarrez le serveur local : ./sudoku_solver serve, puis ouvrez http://127.0.0.1:8080.';
    return;
  }
  const parameters = new URLSearchParams({ type: selectedGenerationType, difficulty: selectedGenerationDifficulty });
  window.location.assign(`/generate?${parameters.toString()}`);
}

slider.addEventListener('input', () => render(Number(slider.value)));
prevButton.addEventListener('click', () => {
  slider.value = Math.max(0, Number(slider.value) - 1);
  render(Number(slider.value));
});
nextButton.addEventListener('click', () => {
  slider.value = Math.min(traceData.steps.length, Number(slider.value) + 1);
  render(Number(slider.value));
});

document.addEventListener('keydown', event => {
  if (manualMode) {
    if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
      event.preventDefault();
      if (event.key.toLowerCase() === 'y' || event.shiftKey)
        restoreManualHistory(manualHistoryIndex + 1);
      else
        restoreManualHistory(manualHistoryIndex - 1);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      pencilMode = !pencilMode;
      entryToggle.textContent = pencilMode ? 'Entrer une possibilite' : 'Entrer une valeur';
      renderManual();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const currentRow = activeCell ? activeCell.row : 0;
      const currentCol = activeCell ? activeCell.col : 0;
      const direction = {
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0]
      }[event.key];
      activeCell = {
        row: Math.max(0, Math.min(manualSnapshot.size - 1, currentRow + direction[0])),
        col: Math.max(0, Math.min(manualSnapshot.size - 1, currentCol + direction[1]))
      };
      renderManual();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      clearActiveCell();
      return;
    }
    if (event.code === 'Digit0' || event.key === '0') {
      event.preventDefault();
      clearActiveCell();
      return;
    }
    const physicalDigit = /^Digit([1-9])$/.exec(event.code);
    const numericKey = /^[1-9]$/.test(event.key) ? Number(event.key) : 0;
    const digit = physicalDigit ? Number(physicalDigit[1]) : numericKey;
    if (digit > 0 && digit <= manualSnapshot.size) {
      event.preventDefault();
      applyDigit(digit);
    }
    return;
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    return;
  }

  event.preventDefault();
  const direction = event.key === 'ArrowLeft' ? -1 : 1;
  slider.value = Math.max(0, Math.min(traceData.steps.length, Number(slider.value) + direction));
  render(Number(slider.value));
});

buildKeypad();
updateHistoryButtons();
updateGenerationChoice();
render(0);
)JS";
    output << "\n</script>\n</body>\n</html>\n";
}

inline void HtmlTraceRenderer::writeToFile(const Grille& grid, const SolverTrace& trace, const std::string& path, const std::string& title) {
    std::ofstream output(path);
    if (!output)
        throw std::runtime_error("Cannot open HTML trace output file.");
    writeToStream(grid, trace, output, title);
}

inline std::string HtmlTraceRenderer::renderToString(const Grille& grid, const SolverTrace& trace, const std::string& title) {
    std::ostringstream output;
    writeToStream(grid, trace, output, title);
    return output.str();
}
