// Route regressions reveal a destination; accordion interactions are checked separately.
export async function revealMenuTarget(target){
 await target.evaluate(element=>{for(let parent=element.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;});
}
