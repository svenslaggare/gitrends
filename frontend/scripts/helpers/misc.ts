export type OnError = (response: any) => void;

export function capitalize(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getErrorMessage(error: any) {
    if (error.response !== undefined) {
        return error.response.data.message;
    } else {
        return "Failed to send request.";
    }
}

export function shortenName(name: string) {
    let parts = name.split(" ");
    if (parts.length > 1) {
        return `${parts[0][0]}. ${parts[parts.length - 1]}`
    } else {
        return name;
    }
}