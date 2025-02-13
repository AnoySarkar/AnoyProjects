let show = '';
let temp = '';
let result;
let num;
let mid = '';

function cal(input) {
    switch (input) {
        case '=':
            if (temp === '' || mid === '') {
                show = 'invalid input';
                result = 0.0;
            } else {
                cal2();
                mid = '';
                show = 'ans';
            }
            break;

        case 'ac':
            show = '';
            result = undefined;
            temp = '';
            mid = '';
            document.querySelector('.top').innerText = '';
            break;

        case '+':
        case '-':
        case '*':
        case '/':
            if (temp === '') return; // Prevent operator input without a number
            cal2();
            mid = input;
            show += ` ${input} `;
            break;

        default:
            show += input;
            temp += input;
    }

    document.querySelector('.show').innerText = show;
}

function cal2() {
    if (temp === '') return;

    num = parseFloat(temp);
    temp = '';

    switch (mid) {
        case '':
            if (result === undefined) result = num; // Fix for first-time calculation
            break;

        case '+':
            result += num;
            break;

        case '-':
            result -= num;
            break;

        case '*':
            result *= num;
            break;

        case '/':
            if (num === 0) {
                show = 'Error: Division by zero';
                result = 0.0;
                return;
            }
            result /= num;
            break;
    }

    document.querySelector('.top').innerText = result;
}
