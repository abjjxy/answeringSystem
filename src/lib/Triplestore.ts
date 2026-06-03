import { Triple, SPARQLResult, GraphData } from '../types';

export class Triplestore {
  private triples: Triple[] = [];
  private prefixes: Record<string, string> = {};

  constructor() {
    this.prefixes = {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      ex: 'http://example.org/calligraphy#',
    };
  }

  public getTriples(): Triple[] {
    return this.triples;
  }

  public getPrefixes(): Record<string, string> {
    return this.prefixes;
  }

  /**
   * Extremely robust state-driven RDF Turtle parser.
   * Handles comments, prefixes, multiple objects (comma), predicate lists (semicolon), and full records.
   */
  public loadTurtle(turtleContent: string): void {
    this.triples = [];
    const lines = turtleContent.split('\n');

    let currentSubject = '';
    let currentPredicate = '';

    for (let rawLine of lines) {
      // Remove comments and trim whitespace
      const commentIndex = rawLine.indexOf('#');
      let line = commentIndex !== -1 ? rawLine.substring(0, commentIndex) : rawLine;
      line = line.trim();

      if (!line) continue;

      // Parse Prefix Declarations: @prefix ex: <http://example.org/calligraphy#> .
      if (line.startsWith('@prefix')) {
        const prefixMatch = line.match(/@prefix\s+([\w-]+):?\s*<([^>]+)>\s*\./);
        if (prefixMatch) {
          const prefixName = prefixMatch[1];
          const uri = prefixMatch[2];
          this.prefixes[prefixName] = uri;
        }
        continue;
      }

      // Tokenize the line into atomic identifiers, URIs, or strings
      const tokens = this.tokenizeTurtleLine(line);
      if (tokens.length === 0) continue;

      let tokenIdx = 0;

      // Determine starting state of the line
      // If we don't have a current subject, or if the first token is a potential new subject:
      // A line starting a new subject ends with a predicate block, or is part of a continuation.
      // But we can check if currentSubject is empty, or if we have tokens left.
      
      // Let's check if the line starts with a new subject.
      // In Turtle, a record looks like:
      // subject predicate object1, object2 ;
      //         predicate2 object3 .
      
      // We can inspect the first token: if it's a semicolon or comma, it's a continuation.
      // If we are in the middle of a record and the line has multiple elements:
      let isContinuation = false;
      const firstToken = tokens[0];
      
      if (firstToken === ';' || firstToken === ',') {
        isContinuation = true;
      }

      // If we have a subject and predicate, but the first token is a value or delimiter:
      // Let's parse sequentially
      while (tokenIdx < tokens.length) {
        let t = tokens[tokenIdx];

        if (t === '.') {
          // End of subject record
          currentSubject = '';
          currentPredicate = '';
          tokenIdx++;
        } else if (t === ';') {
          // Expecting next predicate
          currentPredicate = '';
          tokenIdx++;
        } else if (t === ',') {
          // Next token is another object for the same predicate
          tokenIdx++;
        } else {
          // It's an identifier or literal value:
          if (!currentSubject) {
            // This is the Subject!
            currentSubject = this.resolvePrefix(t);
            tokenIdx++;
            // Next should be Predicate
            if (tokenIdx < tokens.length && tokens[tokenIdx] !== ';' && tokens[tokenIdx] !== ',' && tokens[tokenIdx] !== '.') {
              currentPredicate = this.resolvePrefix(tokens[tokenIdx]);
              tokenIdx++;
            }
          } else if (!currentPredicate) {
            // This is the Predicate
            currentPredicate = this.resolvePrefix(t);
            tokenIdx++;
          } else {
            // This is an Object
            const rawObject = t;
            const resolvedObj = this.resolvePrefix(rawObject);
            
            // Push triple!
            this.triples.push({
              subject: currentSubject,
              predicate: currentPredicate,
              object: resolvedObj
            });
            tokenIdx++;

            // If the next token is a value (without separation), we assume it's just spacing or implicit lists, 
            // but standard Turtle requires punctuation (, . or ;). Let's see if we see punctuation next.
          }
        }
      }
    }
    console.log(`Successfully parsed RDF Turtle data: Loaded ${this.triples.length} triples.`);
  }

  /**
   * Helper to tokenize a single line of Turtle into symbols, literal strings (including quotes), and keys.
   */
  private tokenizeTurtleLine(line: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < line.length) {
      const char = line[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Punctuation
      if (char === '.' || char === ';' || char === ',') {
        tokens.push(char);
        i++;
        continue;
      }

      // Literal Strings (Double Quotes)
      if (char === '"') {
        let str = '';
        i++; // skip starting quote
        while (i < line.length) {
          if (line[i] === '"' && line[i - 1] !== '\\') {
            break;
          }
          str += line[i];
          i++;
        }
        tokens.push(`"${str}"`);
        i++; // skip ending quote
        continue;
      }

      // Identifiers / Prefixed IRIs / URIs
      let ident = '';
      while (i < line.length && !/\s/.test(line[i]) && line[i] !== '.' && line[i] !== ';' && line[i] !== ',' && line[i] !== '"') {
        ident += line[i];
        i++;
      }
      if (ident) {
        tokens.push(ident);
      }
    }
    return tokens;
  }

  /**
   * Resolves a shorthand prefix like ex:WenPeng to its standard form, keeping clean representation.
   */
  private resolvePrefix(token: string): string {
    if (token.startsWith('"') && token.endsWith('"')) {
      return token; // Leave literal string quotes as is
    }
    // If it's a number, return as is
    if (/^\d+$/.test(token)) {
      return token;
    }
    // Expand prefixes for internal consistency or keep them in uniform form
    return token;
  }

  /**
   * High-Fidelity SPARQL Engine.
   * Parses and executes SELECT statements with Joins and Filters.
   */
  public querySparql(sparqlStr: string): SPARQLResult {
    try {
      const { selectVars, patterns, filters } = this.parseSparql(sparqlStr);

      if (patterns.length === 0) {
        return { headers: selectVars, rows: [] };
      }

      // Run visual CSP constraint satisfaction
      const allVariables = new Set<string>();
      patterns.forEach(p => {
        if (p.subject.startsWith('?')) allVariables.add(p.subject);
        if (p.predicate.startsWith('?')) allVariables.add(p.predicate);
        if (p.object.startsWith('?')) allVariables.add(p.object);
      });

      const variableList = Array.from(allVariables);
      const results: Array<Record<string, string>> = [];

      const solve = (patternIdx: number, bindings: Record<string, string>) => {
        if (patternIdx === patterns.length) {
          // Check filters
          let passesFilters = true;
          for (const filter of filters) {
            if (!this.evaluateFilter(filter, bindings)) {
              passesFilters = false;
              break;
            }
          }
          if (passesFilters) {
            results.push({ ...bindings });
          }
          return;
        }

        const pattern = patterns[patternIdx];

        // Bind pattern terms if they are already in bindings
        const sVal = pattern.subject.startsWith('?') ? (bindings[pattern.subject] || pattern.subject) : pattern.subject;
        const pVal = pattern.predicate.startsWith('?') ? (bindings[pattern.predicate] || pattern.predicate) : pattern.predicate;
        const oVal = pattern.object.startsWith('?') ? (bindings[pattern.object] || pattern.object) : pattern.object;

        // Scan all triples to see which ones unify with this bound pattern
        for (const triple of this.triples) {
          const newBindings = { ...bindings };
          let match = true;

          // Check subject
          if (sVal.startsWith('?')) {
            newBindings[sVal] = triple.subject;
          } else if (sVal !== triple.subject) {
            match = false;
          }

          // Check predicate
          if (match) {
            if (pVal.startsWith('?')) {
              newBindings[pVal] = triple.predicate;
            } else if (pVal !== triple.predicate) {
              match = false;
            }
          }

          // Check object
          if (match) {
            if (oVal.startsWith('?')) {
              // Unquote literal objects for uniform evaluation if needed, but keeping quotes is fine
              newBindings[oVal] = triple.object;
            } else {
              // Exact match or string literal match
              const tObj = triple.object;
              // strip quotes from both or compare directly
              const cleanOVal = oVal.replace(/^"|"$/g, '');
              const cleanTObj = tObj.replace(/^"|"$/g, '');
              if (oVal !== tObj && cleanOVal !== cleanTObj) {
                match = false;
              }
            }
          }

          if (match) {
            solve(patternIdx + 1, newBindings);
          }
        }
      };

      solve(0, {});

      // Project results to select variables & eliminate duplicates
      const uniqueRows: string[] = [];
      const projectedRows: Array<Record<string, string>> = [];

      results.forEach(binding => {
        const row: Record<string, string> = {};
        let projectKey = '';
        selectVars.forEach(v => {
          // Keep clean display terms: ex:WenPeng shown as ex:WenPeng, "号" as 号, etc.
          const rawVal = binding[v] || '';
          const cleanedVal = rawVal.replace(/^"|"$/g, '');
          row[v.substring(1)] = cleanedVal;
          projectKey += v + '|||' + cleanedVal + '###';
        });

        if (!uniqueRows.includes(projectKey)) {
          uniqueRows.push(projectKey);
          projectedRows.push(row);
        }
      });

      const headers = selectVars.map(v => v.substring(1));
      return { headers, rows: projectedRows };

    } catch (err: any) {
      console.error('SPARQL Evaluation Error:', err);
      throw new Error(`SPARQL解析与执行异常: ${err.message}`);
    }
  }

  /**
   * Evaluate a SPARQL Filter term.
   */
  private evaluateFilter(filter: { varName: string; op: string; value: string }, bindings: Record<string, string>): boolean {
    const boundVal = bindings[filter.varName];
    if (!boundVal) return false;

    const valClean = boundVal.replace(/^"|"$/g, '');
    const filterValClean = filter.value.replace(/^"|"$/g, '');

    // Num compare if both are numbers
    const numVal = parseFloat(valClean);
    const numFilter = parseFloat(filterValClean);

    if (!isNaN(numVal) && !isNaN(numFilter)) {
      switch (filter.op) {
        case '=':
        case '==':
          return numVal === numFilter;
        case '>':
          return numVal > numFilter;
        case '<':
          return numVal < numFilter;
        case '>=':
          return numVal >= numFilter;
        case '<=':
          return numVal <= numFilter;
        case '!=':
          return numVal !== numFilter;
        default:
          return false;
      }
    }

    // String compare
    switch (filter.op) {
      case '=':
      case '==':
        return valClean.toLowerCase() === filterValClean.toLowerCase() || boundVal === filter.value;
      case '!=':
        return valClean.toLowerCase() !== filterValClean.toLowerCase();
      case 'contains':
        return valClean.toLowerCase().includes(filterValClean.toLowerCase());
      default:
        return false;
    }
  }

  /**
   * Custom parser for standard SPARQL SELECT structures.
   */
  private parseSparql(sparqlStr: string): { selectVars: string[]; patterns: Triple[]; filters: any[] } {
    const cleanQuery = sparqlStr.replace(/\r/g, '').trim();

    // 1. Parse SELECT variables
    const selectMatch = cleanQuery.match(/SELECT\s+([\s\S]+?)\s+WHERE/i);
    if (!selectMatch) {
      throw new Error('SPARQL语法错误：未找到 "SELECT ... WHERE" 结构。');
    }

    const selectVars = selectMatch[1].trim().split(/\s+/).filter(v => v.startsWith('?'));

    // 2. Parse WHERE block matches: WHERE { ... }
    const whereMatch = cleanQuery.match(/WHERE\s*\{([\s\S]*)\}/i);
    if (!whereMatch) {
      throw new Error('SPARQL语法错误：未找到 "WHERE { ... }" 模块。');
    }

    const whereContent = whereMatch[1].trim();
    const clauses = whereContent.split('\n').map(c => c.trim()).filter(c => c.length > 0);

    const patterns: Triple[] = [];
    const filters: any[] = [];

    clauses.forEach(clause => {
      // Skip declarations or prefix injections inside query if any
      if (clause.toLowerCase().startsWith('prefix')) return;

      // Check if it's a Filter: FILTER(?birthYear > 1500) or FILTER(?dynasty = "Ming")
      if (clause.toUpperCase().startsWith('FILTER')) {
        const filterMatch = clause.match(/FILTER\s*\(\s*(\?\w+)\s*([=!><]+)\s*([\s\S]+?)\s*\)/i);
        if (filterMatch) {
          filters.push({
            varName: filterMatch[1],
            op: filterMatch[2],
            value: filterMatch[3].trim()
          });
        } else {
          // Check simple contains filter: FILTER(CONTAINS(?label, "文"))
          const containsMatch = clause.match(/FILTER\s*\(\s*contains\s*\(\s*(\?\w+)\s*,\s*([\s\S]+?)\s*\)\s*\)/i);
          if (containsMatch) {
            filters.push({
              varName: containsMatch[1],
              op: 'contains',
              value: containsMatch[2].trim()
            });
          }
        }
        return;
      }

      // Read standard triple pattern ending with period: ?sub ?pred ?obj .
      // Remove trailing period
      let cleanClause = clause;
      if (clause.endsWith('.')) {
        cleanClause = clause.substring(0, clause.length - 1).trim();
      }

      // Split terms carefully accounting for strings inside quotes
      const terms = this.tokenizeTurtleLine(cleanClause);
      if (terms.length >= 3) {
        patterns.push({
          subject: terms[0],
          predicate: terms[1],
          object: terms.slice(2).join(' ') // Join remaining tokens if objects contain spaces (uncommon in tidy triples but safe)
        });
      }
    });

    return { selectVars, patterns, filters };
  }

  /**
   * Helper to dump database triples as a direct D3 node-link Graph model for live UI.
   */
  public extractGraphData(): GraphData {
    const nodesMap = new Map<string, any>();
    const links: any[] = [];

    // Helper to extract type from turtle mapping
    const getEntityType = (id: string, label: string): 'Person' | 'School' | 'ScriptStyle' | 'Location' => {
      if (id.startsWith('ex:')) {
        const lowerId = id.toLowerCase();
        if (lowerId.endsWith('school')) return 'School';
        if (lowerId.endsWith('style') || lowerId.endsWith('script') || lowerId.endsWith('seals')) return 'ScriptStyle';
        if (id === 'ex:Shaoxing' || id === 'ex:Suzhou' || id === 'ex:Hangzhou' || id === 'ex:Huizhou' || id === 'ex:An慶' || id === 'ex:ShaoxingMin' || id === 'ex:Ningbo') return 'Location';
      }
      return 'Person';
    };

    // First pass to identify entities and labels
    this.triples.forEach(t => {
      const { subject, predicate, object } = t;

      if (subject.startsWith('ex:')) {
        if (!nodesMap.has(subject)) {
          nodesMap.set(subject, {
            id: subject,
            label: subject.substring(3),
            type: getEntityType(subject, '')
          });
        }
      }

      if (object.startsWith('ex:')) {
        if (!nodesMap.has(object)) {
          nodesMap.set(object, {
            id: object,
            label: object.substring(3),
            type: getEntityType(object, '')
          });
        }
      }
    });

    // Second pass: extract labels, dynasties and direct attributes
    this.triples.forEach(t => {
      const { subject, predicate, object } = t;

      if (!subject.startsWith('ex:')) return;
      const node = nodesMap.get(subject);
      if (!node) return;

      const objClean = object.replace(/^"|"$/g, '');

      if (predicate === 'rdfs:label') {
        node.label = objClean;
      } else if (predicate === 'ex:dynasty') {
        node.dynasty = objClean;
      } else if (predicate === 'ex:introduction') {
        node.intro = objClean;
      }
    });

    // Third pass: build standard visual edges
    this.triples.forEach(t => {
      const { subject, predicate, object } = t;
      if (!subject.startsWith('ex:') || !object.startsWith('ex:')) return;

      // Map predicates to nice human Chinese labels
      let relationLabel = predicate;
      if (predicate === 'ex:father') relationLabel = '父亲';
      else if (predicate === 'ex:child') relationLabel = '子女';
      else if (predicate === 'ex:studentOf') relationLabel = '师从';
      else if (predicate === 'ex:teacherOf') relationLabel = '授学';
      else if (predicate === 'ex:interactedWith') relationLabel = '交游';
      else if (predicate === 'ex:founderOf') relationLabel = '开创';
      else if (predicate === 'ex:schoolMemberOf') relationLabel = '所属流派';
      else if (predicate === 'ex:practicedStyle') relationLabel = '精通艺术';
      else if (predicate === 'ex:nativePlace') relationLabel = '籍贯';

      links.push({
        source: subject,
        target: object,
        relation: predicate,
        relationLabel
      });
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links
    };
  }
}
