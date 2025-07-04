const fs = require('fs');
const path = require('path');
const util = require('util');
const yaml = require('js-yaml');



const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const COMPENDIUMS_DIR = path.join(__dirname, '../Compendiums/CSRD/en/');
const FRONTMATTER_DIR = path.join(__dirname, '../Frontmattered/Compendiums/CSRD/en/');
const SKIP_COLLECTIONS = ['Rules', 'Tables'];
// Function to recursively find all files in a directory
async function parseTags(fm) {
    const newFm = {};
    newFm.title = fm.aliases[0].trim();
    // Ensure each alias is wrapped in double quotes only, not single quotes
    newFm.aliases = fm.aliases;
    newFm.collection = fm.tags[0].split('/')[3].trim() ?? null;
    newFm.kind = fm.tags[1].split('/')[0].trim() ?? 'Unknown';
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
        case 'ARTIFACTS':
            const kindAry = fm.tags.filter(tag => tag.toUpperCase().includes('/KIND/'));
            const cleanKind = kindAry.map(tag => tag.split('/')[2]);
            collectionProperties.categories = cleanKind;
            break;
        case 'CANTRIPS':
            // pool array
            newFm.kind = 'Cantrip';
            const cantripPoolAry = fm.tags.filter(tag => tag.toUpperCase().includes('/POOL/'));
            const cleanCanTripPoolAry = cantripPoolAry.map(tag => tag.split('/')[2]);
            collectionProperties.pools = cleanCanTripPoolAry;
            // cantrip cost
            const cantripCostIdx = fm.tags.findIndex(tag => tag.toUpperCase().includes('/COST/'));
            const cantripCostPropertyIdx = fm.tags[cantripCostIdx].split('/').findIndex(tag => tag.toUpperCase().includes('COST'));
            collectionProperties.cost = (cantripCostPropertyIdx + cantripCostIdx) >= 0 ? fm.tags[cantripCostIdx].split('/')[cantripCostPropertyIdx + 1] : 'NA';
            break;
        case 'CREATURES-NPCS':
            const kindOfCreature = fm.tags.find(tag => tag.toUpperCase().includes('/KIND/'));
            if (kindOfCreature) {
                //console.log(`Kind of Creature: ${kindOfCreature.split('/')[2].trim()}`);
                newFm.kind = kindOfCreature.split('/')[2].trim();
            }
            const creatureLevelPropertyIdx = fm.tags.find(tag => tag.toUpperCase().includes('/LEVEL/'));
            collectionProperties.level = parseInt(creatureLevelPropertyIdx.split('/')[2].trim());
            // Handle creatures and NPCs armor
            const creatureArmor = fm.tags.find(tag => tag.toUpperCase().includes('/ARMOR/'));
            collectionProperties.armor = parseInt(creatureArmor.split('/')[2].trim());
            //Handle creatures and NPCs health
            const creatureHealth = fm.tags.find(tag => tag.toUpperCase().includes('/HEALTH/'));
            collectionProperties.health = parseInt(creatureHealth.split('/')[2].trim());
        default:
            // Silently handle unknown collection or use a custom logger
            // that can be disabled in production
            break;
    }
    return { ...fm, ...newFm, ...collectionProperties};
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
        
        // Compute relative path and output path
        const relPath = path.relative(COMPENDIUMS_DIR, filePath);
        const outPath = path.join(FRONTMATTER_DIR, relPath);

        // Ensure output directory exists
        fs.mkdirSync(path.dirname(outPath), { recursive: true });

        // Write the modified content to the new directory
        // Check if the file is in a directory we should skip
        const shouldSkip = SKIP_COLLECTIONS.some(skipDir => relPath.includes(`/${skipDir}/`));
        if (shouldSkip) {
            console.log(`Skipping file in excluded directory: ${relPath}`);
            //return;
        } else {
            await writeFile(outPath, newContent, 'utf8');
            //console.log(`Updated frontmatter in ${outPath}`);
        }
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