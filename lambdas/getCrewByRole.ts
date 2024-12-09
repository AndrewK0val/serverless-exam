import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

type ResponseBody = {
  data: {
    crew?: any[];
  };
};

const ajv = new Ajv({ coerceTypes: true });
const isValidQueryParams = ajv.compile(
  schema.definitions["CrewQueryParams"] || {}
);
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event));

    const pathParameters = event?.pathParameters;
    const queryStringParameters = event?.queryStringParameters;
    const movieId = pathParameters?.movieId
      ? parseInt(pathParameters.movieId)
      : undefined;
    const role = pathParameters?.role;
    const nameSubstring = queryStringParameters?.name;

    if (!movieId || !role) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing required path parameters" }),
      };
    }

    const queryCommandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "movieId = :m AND crewRole = :r",
      ExpressionAttributeValues: {
        ":m": movieId,
        ":r": role,
      },
    };

    const queryCommandOutput = await ddbDocClient.send(
      new QueryCommand(queryCommandInput)
    );

    if (!queryCommandOutput.Items || queryCommandOutput.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "No crew members found" }),
      };
    }

    let crew = queryCommandOutput.Items;

    // Filter by name substring if provided
    if (nameSubstring) {
      crew = crew.filter((member) =>
        member.name.toLowerCase().includes(nameSubstring.toLowerCase())
      );
    }

    const responseBody: ResponseBody = {
      data: {
        crew: crew,
      },
    };

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.error("Error: ", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}