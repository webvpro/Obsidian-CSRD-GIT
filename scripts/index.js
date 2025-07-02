const fs = require('fs');
const path = require('path');
const util = require('util');
const yaml = require('js-yaml');



const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const COMPENDIUMS_DIR = path.join(__dirname, '../Compendiums/CSRD/en/');
const FRONTMATTERED_DIR = path.join(__dirname, '../Frontmattered/Compendiums/CSRD/en/');

// Function to recursively find all files in a directory
async function parseTags(fm) {
    const newFm = {};
    newFm.title = fm.aliases[0].trim();
    // Ensure each alias is wrapped in double quotes only, not single quotes
    newFm.aliases = fm.aliases;
    newFm.collection = fm.tags[0].split('/')[3].trim() ?? null;
    newFm.kind = fm.tags[0].split('/')[0].trim();
    let collectionProperties = {};
    switch (newFm.collection.toUpperCase()) {
        case 'ABILITIES':
            // Handle ability kind
            collectionProperties.action = fm.tags[2].split('/')[1].toUpperCase().trim() === 'ACTION' ? true : false;
            collectionProperties.enabler = fm.tags[2].split('/')[1].toUpperCase().trim() === 'ENABLER' ? true : false;
            //cost 
            const costIdx = fm.tags.findIndex(tag => tag.toUpperCase().includes('/COST/'));
            const costPropertyIdx = fm.tags[costIdx].split('/').findIndex(tag => tag.toUpperCase().includes('COST'));
            collectionProperties.cost = (costPropertyIdx + costIdx) >= 0 ? fm.tags[costIdx].split('/')[costPropertyIdx + 1] : 'NA';

            // Tier
            const tierIdx = fm.tags.findIndex(tag => tag.toUpperCase().includes('/TIER/'));
            const tierPropertyIdx = fm.tags[tierIdx].split('/').findIndex(tag => tag.toUpperCase().includes('TIER'));
        //console.log(`TierPropertyIdx: ${tierPropertyIdx}, TierIdx: ${tierIdx}, Tags: ${fm.tags[tierIdx].split('/')[tierPropertyIdx +1]}`);
            collectionProperties.tier = tierPropertyIdx >= 0 ? fm.tags[tierIdx].split('/')[tierPropertyIdx +1] : 'NA';
            // Pool
            const poolAry = fm.tags.filter(tag => tag.toUpperCase().includes('/POOL/'));
            const cleanPoolAry = poolAry.map(tag => tag.split('/')[2]);
            collectionProperties.pools = cleanPoolAry;
            //category
            const categoryAry = fm.tags.filter(tag => tag.toUpperCase().includes('/CATEGORIES/'));
            const cleanCategory = categoryAry.map(tag => tag.split('/')[2]);
            collectionProperties.categories = cleanCategory;
            break  ;
        case 'reference':
            // Handle reference kind
            break;
        default:
            // Silently handle unknown collection or use a custom logger
            // that can be disabled in production
            break;
    }
    return { ...fm, ...newFm  };
};
async function getAllFiles(dirPath, arrayOfFiles) {
    const files = await readdir(dirPath, { withFileTypes: true });

    arrayOfFiles = arrayOfFiles || [];

    for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
            await getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    }

    return arrayOfFiles;
}

// Function to process the frontmatter in a markdown file
async function processFrontmatter(filePath) {
    try {
        console.log(`Processing: ${filePath}`);
        
        const content = await readFile(filePath, 'utf8');
         
        // Regular expression to match frontmatter between --- markers
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
            console.log(`No frontmatter found in ${filePath}`);
            return; 
        }

        // Extract and parse the frontmatter
        const frontmatter = match[1];
        const frontmatterObj = yaml.load(frontmatter);

        // Append or update fields in the frontmatter
        // You can add more fields as needed

        // Convert the modified frontmatter back to YAML format
        const newFm = await parseTags(frontmatterObj);
        const newFrontmatter = yaml.dump(newFm);

        // Replace the old frontmatter with the new one, preserving the rest of the file
        const newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}---\n`);
        
        // Write the modified content back to the file
        await writeFile(filePath, newContent, 'utf8');
        console.log(`Updated frontmatter in ${filePath}`);
        
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

// Main function to process all markdown files
async function main() {
    try {
        console.log(`Looking for markdown files in ${COMPENDIUMS_DIR}`);
        
        if (!fs.existsSync(COMPENDIUMS_DIR)) {
            console.error(`Directory not found: ${COMPENDIUMS_DIR}`);
            return;
        }
        
        // Read all files in the directory
        const allFiles = await getAllFiles(COMPENDIUMS_DIR);
        const mdFiles = allFiles.filter(file => file.endsWith('.md'));
        
        console.log(`Found ${mdFiles.length} markdown files`);
        
        // Process each markdown file
        const promises = mdFiles.map(file => 
            processFrontmatter(file)
        );
        
        await Promise.all(promises);
        
        console.log('All files processed successfully!');
        
    } catch (err) {
        console.error('Error processing files:', err);
    }
}

// Run the script
main();