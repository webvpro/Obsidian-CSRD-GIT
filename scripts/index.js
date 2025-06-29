const fs = require('fs');
const path = require('path');
const util = require('util');
const yaml = require('js-yaml');



const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const COMPENDIUMS_DIR = path.join(__dirname, '../Compendiums/CSRD/en/');

// Function to recursively find all files in a directory
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

        console.log(`Aliases for ${filePath}:`, frontmatterObj.aliases || 'None');
        console.log(`Tags for ${filePath}:`, frontmatterObj.tags || 'None');
        
        // Convert the modified frontmatter back to YAML format
        const newFrontmatter = yaml.dump(frontmatterObj);
        
        // Replace the old frontmatter with the new one
        const newContent = content.replace(
            frontmatterRegex, 
            `---\n${newFrontmatter}---\n`
        );
        
        // Write the modified content back to the file
        //await writeFile(filePath, newContent, 'utf8');
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