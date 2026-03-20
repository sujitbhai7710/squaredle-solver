/**
 * Trie (Prefix Tree) data structure for efficient word lookups
 * Used in the Squaredle solver for fast prefix and word validation
 */

export interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  word?: string;
}

export class Trie {
  private root: TrieNode;
  private wordCount: number = 0;

  constructor() {
    this.root = this.createNode();
  }

  private createNode(): TrieNode {
    return {
      children: new Map(),
      isEndOfWord: false
    };
  }

  /**
   * Insert a word into the trie
   */
  insert(word: string): void {
    let node = this.root;
    const normalizedWord = word.toLowerCase().trim();
    
    if (!normalizedWord) return;

    for (const char of normalizedWord) {
      if (!node.children.has(char)) {
        node.children.set(char, this.createNode());
      }
      node = node.children.get(char)!;
    }
    
    if (!node.isEndOfWord) {
      this.wordCount++;
    }
    node.isEndOfWord = true;
    node.word = normalizedWord;
  }

  /**
   * Insert multiple words into the trie
   */
  insertWords(words: string[]): void {
    for (const word of words) {
      this.insert(word);
    }
  }

  /**
   * Check if a word exists in the trie
   */
  search(word: string): boolean {
    const node = this.findNode(word);
    return node !== null && node.isEndOfWord;
  }

  /**
   * Check if a prefix exists in the trie
   * Returns true if there are any words that start with the prefix
   */
  startsWith(prefix: string): boolean {
    return this.findNode(prefix) !== null;
  }

  /**
   * Find the node for a given prefix/word
   * Returns null if not found
   */
  findNode(prefix: string): TrieNode | null {
    let node = this.root;
    const normalizedPrefix = prefix.toLowerCase().trim();

    for (const char of normalizedPrefix) {
      if (!node.children.has(char)) {
        return null;
      }
      node = node.children.get(char)!;
    }

    return node;
  }

  /**
   * Get all words that start with a given prefix
   */
  getWordsWithPrefix(prefix: string): string[] {
    const node = this.findNode(prefix);
    if (!node) return [];

    const words: string[] = [];
    this.collectWords(node, prefix.toLowerCase(), words);
    return words;
  }

  /**
   * Collect all words from a given node
   */
  private collectWords(node: TrieNode, prefix: string, words: string[]): void {
    if (node.isEndOfWord && node.word) {
      words.push(node.word);
    }

    for (const [char, childNode] of node.children) {
      this.collectWords(childNode, prefix + char, words);
    }
  }

  /**
   * Get the root node (for DFS traversal in solver)
   */
  getRoot(): TrieNode {
    return this.root;
  }

  /**
   * Get the total number of words in the trie
   */
  getWordCount(): number {
    return this.wordCount;
  }
}

// Singleton instance for the word dictionary
let dictionaryTrie: Trie | null = null;

/**
 * Initialize the dictionary trie with a comprehensive word list
 */
export function initializeDictionary(words: string[]): Trie {
  if (!dictionaryTrie) {
    dictionaryTrie = new Trie();
    dictionaryTrie.insertWords(words);
  }
  return dictionaryTrie;
}

/**
 * Get the dictionary trie instance
 */
export function getDictionary(): Trie | null {
  return dictionaryTrie;
}

/**
 * Reset the dictionary (useful for testing)
 */
export function resetDictionary(): void {
  dictionaryTrie = null;
}
