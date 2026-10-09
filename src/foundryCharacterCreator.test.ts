import{describe,it,expect}from'vitest';import fs from'node:fs';
const creator=fs.readFileSync('foundry-module/scripts/character-creator.js','utf8');
const approval=fs.readFileSync('foundry-module/scripts/approval.js','utf8');
const srd=fs.readFileSync('foundry-module/scripts/srd-catalog.js','utf8');
describe('Foundry character creator stress/audit guards',()=>{
 it('separates 2014 and 2024 SRD modes',()=>{expect(creator).toContain('rulesVersion:"2024"');expect(creator).toContain('data-rules="2014"');expect(creator).toContain('data-rules="2024"');expect(srd).toContain('RULES={2014:"2014",2024:"2024"}')});
 it('guards rapid catalog loads from stale results',()=>{expect(creator).toContain('loadToken');expect(creator).toContain('token!==state.loadToken')});
 it('prevents repeated add clicks while an item is being embedded',()=>{expect(creator).toContain('b.disabled=true');expect(creator).toContain('finally{b.disabled=false}')});
 it('keeps custom approvals GM-only and private by default',()=>{expect(approval).toContain('if(!game.user.isGM)throw new Error("Only a GM can review submissions.")');expect(approval).toContain('default:CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE')});
 it('supports spellbook and core character content categories',()=>{for(const value of ['Spell Book','Equipment & Items','Feats','Species','Classes','Backgrounds'])expect(creator).toContain(value)});
});
