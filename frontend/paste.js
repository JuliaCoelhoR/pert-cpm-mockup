const COLUMNS = ['description', 'prerequisites', 'duration', 'costPerDay'];

export function parseTabPaste(text) {
    if (!text) return [];

    return text
        .split(/\r?\n/)
        .filter(line => line.trim() !== '')
        .map(line => {
            const cols = line.split('\t');
            return {
                description:   cols[0] ?? '',
                prerequisites: cols[1] ?? '',
                duration:      cols[2] ?? '',
                costPerDay:    cols[3] ?? '',
            };
        });
}
