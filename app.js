
let boxes = document.querySelectorAll(".box");
let turnO = true;

let winSound = new Audio("End.wav");
let tapSound = new Audio("tap.wav");
let newSound = new Audio("newgame.mp3");
let tieSound = new Audio("Draw.wav");




const winPatterns = [
      [0,1,2],
      [0,3,6],
      [0,4,8],
      [1,4,7],
      [2,5,8],
      [2,4,6],
      [3,4,5],
      [6,7,8],
]

boxes.forEach((box) => {
  box.addEventListener("click",() =>{
    tapSound.play();
   if(turnO){
      box.innerText = "O";
      turnO = false;
    } 
    else{
      box.innerText = "X";
      turnO = true;
    }
    box.disabled = true;

    checkWinner();

});
});


function reset(){
  newSound.play();
  turnO = true;
  enableBoxes();
  document.querySelector(".winner").innerText = "....";
}

const enableBoxes = () => {
  for (let  box of boxes) {
    box.disabled = false;
    box.innerText = "";
    box.style.backgroundColor = 'rgb(27, 27, 27)';
  }
}

const disableBoxes = () => {
  for (let  box of boxes) {
    box.disabled = true;
  }
}



const checkWinner = () => {

  for (let pattern of winPatterns) {
    let pos1 = boxes[pattern[0]].innerText;
    let pos2 = boxes[pattern[1]].innerText;
    let pos3 = boxes[pattern[2]].innerText;



    if (pos1 != '' && pos2 != '' && pos3 != ''){

        if (pos1 === 'O' && pos2 === 'O' && pos3 === 'O'){
          winSound.play();
          document.querySelector(".winner").innerText = 'O wins!';
          boxes[pattern[0]].style.backgroundColor = 'green';
          boxes[pattern[1]].style.backgroundColor = 'green';
          boxes[pattern[2]].style.backgroundColor = 'green';

          disableBoxes();
          
        }
        else if (pos1 === 'X' && pos2 === 'X' && pos3 === 'X'){
          winSound.play();
          document.querySelector(".winner").innerText = 'X wins!';
          boxes[pattern[0]].style.backgroundColor = 'green';
          boxes[pattern[1]].style.backgroundColor = 'green';
          boxes[pattern[2]].style.backgroundColor = 'green';

          disableBoxes();

        }


      
    }


    
  }
}

