/**
 * Utility to generate Markdown documentation from a database schema object.
 */

const generateTableMermaid = (table, schema) => {
    const allFks = schema.foreign_keys || [];
    const tableFks = allFks.filter(fk => fk.source_table === table.name || fk.target_table === table.name);
    if (tableFks.length === 0) return '';

    let mermaid = `\n#### Relationship Map\n\n\`\`\`mermaid\nerDiagram\n`;
    
    // Simplification: Only show relationships by name, no fields to avoid clipping
    tableFks.forEach(fk => {
        const source = fk.source_table.replace(/[^a-zA-Z0-9]/g, '_');
        const target = fk.target_table.replace(/[^a-zA-Z0-9]/g, '_');
        mermaid += `    ${source} ||--o{ ${target} : "${fk.constraint_name}"\n`;
    });
    
    mermaid += `\`\`\`\n`;
    return mermaid;
};

export const generateSchemaMarkdown = (schema) => {
    if (!schema || !schema.tables) return '# No Schema Loaded\n\nPlease connect to a database to generate documentation.';

    let md = `# Database Schema: ${schema.database || 'Active Database'}\n\n`;
    
    // 1. Mermaid Global Relationship Diagram
    if (schema.foreign_keys && schema.foreign_keys.length > 0) {
        md += `## Entity Relationship Diagram\n\n`;
        md += `\`\`\`mermaid\nerDiagram\n`;
        
        // Define relations (Mermaid handles table creation from relations)
        schema.foreign_keys.forEach(fk => {
            const source = fk.source_table.replace(/[^a-zA-Z0-9]/g, '_');
            const target = fk.target_table.replace(/[^a-zA-Z0-9]/g, '_');
            md += `    ${source} ||--o{ ${target} : "${fk.constraint_name}"\n`;
        });
        
        md += `\`\`\`\n\n`;
    }

    // 2. Tables Overview
    md += `## Tables Overview\n\n`;
    md += `| Table | Columns | Rows (Approx) |\n`;
    md += `| :--- | :--- | :--- |\n`;
    schema.tables.forEach(table => {
        md += `| [${table.name}](#table-${table.name.toLowerCase()}) | ${table.columns.length} | ${table.row_count || 'N/A'} |\n`;
    });
    md += `\n---\n\n`;

    // 3. Detailed Table Specs
    schema.tables.forEach(table => {
        // Table title with navigation link
        md += `### [Table: ${table.name}](navigate-table-${table.name.toLowerCase()})\n\n`;
        
        // Relationship map (Local)
        md += generateTableMermaid(table, schema);

        md += `\n#### Columns\n\n`;
        md += `| Column | Type | Nullable | PK | Extra |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- |\n`;
        
        table.columns.forEach(col => {
            const pk = col.is_primary ? '✅' : '';
            const nul = col.is_nullable ? 'YES' : 'NO';
            const meta = [
                col.is_unique ? 'Unique' : '',
                col.is_autoincrement ? 'Auto' : '',
                col.default_value ? `Default: ${col.default_value}` : ''
            ].filter(Boolean).join(', ');

            md += `| **${col.name}** | \`${col.data_type}\` | ${nul} | ${pk} | ${meta} |\n`;
        });

        const sourceFks = (schema.foreign_keys || []).filter(fk => fk.source_table === table.name);
        if (sourceFks.length > 0) {
            md += `\n**Direct Links:**\n`;
            sourceFks.forEach(fk => {
                md += `- \`${fk.source_column}\` -> [${fk.target_table}](#table-${fk.target_table.toLowerCase()}).\`${fk.target_column}\` (${fk.constraint_name})\n`;
            });
        }

        md += `\n[Back to top](#tables-overview)\n\n`;
        md += `---\n\n`;
    });

    return md;
};
